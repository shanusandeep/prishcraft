import * as THREE from 'three';
import { World } from './world';
import { isSolid, WATER } from './blocks';
import { buildAvatar } from './avatar';
import { groundBelow } from './npc';
import { lerpAngle } from './creatures';

// The dark side of the campaign. Names follow the same private-family-build
// rule as characters.ts — rename before any public release.

export type EnemyKind =
  | 'slime' | 'werewolf' | 'pixie' | 'spider' | 'troll'
  | 'basilisk' | 'dementor' | 'deatheater' | 'voldemort';

interface KindDef {
  label: string;
  hp: number;
  speed: number;
  damage: number;
  /** blocks: how close before they bite/bonk */
  attackRange: number;
  flyer?: boolean;
  /** approx half-width / height of the hit box */
  size: [number, number];
  aggro: number;
  poofColor: number;
}

export const KINDS: Record<EnemyKind, KindDef> = {
  slime: { label: 'Gloom Slime', hp: 3, speed: 2.2, damage: 1, attackRange: 1.2, size: [0.5, 0.9], aggro: 20, poofColor: 0x7ec46e },
  werewolf: { label: 'Werewolf', hp: 5, speed: 3.6, damage: 1, attackRange: 1.4, size: [0.45, 1.8], aggro: 26, poofColor: 0x8a7a6a },
  pixie: { label: 'Mischief Pixie', hp: 2, speed: 4.2, damage: 1, attackRange: 1.2, flyer: true, size: [0.35, 0.8], aggro: 30, poofColor: 0x5fa8e0 },
  spider: { label: 'Giant Spider', hp: 6, speed: 3.0, damage: 1, attackRange: 1.4, size: [0.8, 1.0], aggro: 24, poofColor: 0x3a3a4e },
  troll: { label: 'Cave Troll', hp: 14, speed: 1.4, damage: 2, attackRange: 1.8, size: [0.7, 3.0], aggro: 22, poofColor: 0x6e7a5a },
  basilisk: { label: 'The Basilisk', hp: 30, speed: 3.2, damage: 2, attackRange: 1.8, size: [0.9, 1.4], aggro: 60, poofColor: 0x4a9e5f },
  dementor: { label: 'Dementor', hp: 6, speed: 2.4, damage: 0, attackRange: 0, flyer: true, size: [0.5, 2.0], aggro: 34, poofColor: 0x3a3a4e },
  deatheater: { label: 'Death Eater', hp: 8, speed: 3.0, damage: 1, attackRange: 1.6, size: [0.45, 1.8], aggro: 36, poofColor: 0x26262e },
  voldemort: { label: 'LORD VOLDEMORT', hp: 60, speed: 2.6, damage: 2, attackRange: 2.0, size: [0.55, 2.2], aggro: 90, poofColor: 0x1a1a22 },
};

export interface EnemyCtx {
  world: () => World;
  playerPos: THREE.Vector3;
  isNight: () => boolean;
  damagePlayer: (amount: number, why: string) => void;
  onDefeated: (kind: EnemyKind, pos: THREE.Vector3) => void;
  burst: (x: number, y: number, z: number, color: number, n: number) => void;
  summon: (kind: EnemyKind, n: number, around: THREE.Vector3) => void;
  fireAtPlayer: (from: THREE.Vector3, count: number) => void;
}

function makeHpBar(): { sprite: THREE.Sprite; draw: (frac: number) => void } {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 10;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set(1.2, 0.18, 1);
  const draw = (frac: number) => {
    ctx.clearRect(0, 0, 64, 10);
    ctx.fillStyle = 'rgba(20,20,40,0.7)';
    ctx.fillRect(0, 0, 64, 10);
    ctx.fillStyle = frac > 0.5 ? '#7be0a0' : frac > 0.25 ? '#ffd24a' : '#e06a6a';
    ctx.fillRect(2, 2, 60 * Math.max(0, frac), 6);
    tex.needsUpdate = true;
  };
  draw(1);
  return { sprite, draw };
}

export class Enemy {
  def: KindDef;
  hp: number;
  maxHp: number;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3(); // knockback
  group = new THREE.Group();
  stunned = 0; // patronus
  dead = false;

  private heading = Math.random() * Math.PI * 2;
  private time = Math.random() * 10;
  private attackCooldown = 0;
  private shootCooldown = 2 + Math.random() * 2;
  private teleportCooldown = 6;
  private summonedAt: number[] = [];
  private mats: THREE.MeshLambertMaterial[] = [];
  private flash = 0;
  private bar: { sprite: THREE.Sprite; draw: (frac: number) => void };
  private segments: THREE.Mesh[] = []; // basilisk
  private segmentPos: THREE.Vector3[] = [];
  private wings: THREE.Mesh[] = [];
  private legs: THREE.Mesh[] = [];

  constructor(public kind: EnemyKind, public shadow = false) {
    this.def = KINDS[kind];
    this.maxHp = this.shadow ? Math.round(this.def.hp * 2.5) : this.def.hp;
    this.hp = this.maxHp;
    this.buildMesh();
    this.bar = makeHpBar();
    this.bar.sprite.position.y = this.def.size[1] + 0.5;
    this.group.add(this.bar.sprite);
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && (mesh.material as THREE.MeshLambertMaterial).isMeshLambertMaterial) {
        this.mats.push(mesh.material as THREE.MeshLambertMaterial);
      }
    });
    if (this.shadow) {
      // shadow-touched: darker, purple-tinged, unmistakably WRONG
      const shade = new THREE.Color(0x4a2a6a);
      for (const m of this.mats) m.color.lerp(shade, 0.55);
      for (const seg of this.segments) (seg.material as THREE.MeshLambertMaterial).color.lerp(shade, 0.55);
    }
  }

  get label(): string {
    return this.shadow ? `Shadow ${this.def.label}` : this.def.label;
  }

  private box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    return mesh;
  }

  private buildMesh(): void {
    switch (this.kind) {
      case 'slime': {
        const body = this.box(0.9, 0.8, 0.9, 0x6ec46e, 0, 0.45, 0);
        (body.material as THREE.MeshLambertMaterial).transparent = true;
        (body.material as THREE.MeshLambertMaterial).opacity = 0.85;
        this.box(0.12, 0.16, 0.05, 0x1a2a1a, -0.2, 0.6, 0.46);
        this.box(0.12, 0.16, 0.05, 0x1a2a1a, 0.2, 0.6, 0.46);
        break;
      }
      case 'werewolf': {
        const rig = buildAvatar({ body: 0x6e5a4a, legs: 0x5a4a3c, hair: 0x4a3a2e, ears: true, scale: 0.95 });
        this.group.add(rig.group);
        this.box(0.2, 0.2, 0.5, 0x5a4a3c, 0, 0.7, -0.4); // tail
        break;
      }
      case 'pixie': {
        const rig = buildAvatar({ body: 0x5fa8e0, legs: 0x3a78b0, hair: 0x9ad4ff, ears: true, scale: 0.42 });
        this.group.add(rig.group);
        this.wings.push(
          this.box(0.05, 0.5, 0.3, 0xcfeaff, -0.25, 0.55, -0.1),
          this.box(0.05, 0.5, 0.3, 0xcfeaff, 0.25, 0.55, -0.1),
        );
        break;
      }
      case 'spider': {
        this.box(1.1, 0.55, 1.3, 0x3a3a4e, 0, 0.55, 0);
        this.box(0.6, 0.5, 0.6, 0x2e2e40, 0, 0.6, 0.85);
        this.box(0.1, 0.1, 0.06, 0xe06a6a, -0.14, 0.7, 1.16);
        this.box(0.1, 0.1, 0.06, 0xe06a6a, 0.14, 0.7, 1.16);
        for (let i = 0; i < 4; i++) {
          this.legs.push(
            this.box(0.85, 0.1, 0.1, 0x2e2e40, -0.85, 0.5, -0.45 + i * 0.3),
            this.box(0.85, 0.1, 0.1, 0x2e2e40, 0.85, 0.5, -0.45 + i * 0.3),
          );
        }
        break;
      }
      case 'troll': {
        const rig = buildAvatar({ body: 0x6e7a5a, legs: 0x5a644a, hair: 0x4a5440, scale: 1.7 });
        this.group.add(rig.group);
        this.box(0.5, 1.1, 0.5, 0x8a8a7a, 0.9, 1.0, 0); // a very large club
        break;
      }
      case 'basilisk': {
        // head
        this.box(1.1, 0.9, 1.4, 0x4a9e5f, 0, 0.7, 0);
        this.box(0.16, 0.2, 0.08, 0xffd24a, -0.25, 0.95, 0.72);
        this.box(0.16, 0.2, 0.08, 0xffd24a, 0.25, 0.95, 0.72);
        this.box(0.1, 0.05, 0.5, 0xe06a8a, 0, 0.45, 0.9); // tongue
        // body segments live OUTSIDE the group so they can trail
        for (let i = 0; i < 6; i++) {
          const s = 0.85 - i * 0.08;
          const seg = new THREE.Mesh(
            new THREE.BoxGeometry(s, s, s + 0.2),
            new THREE.MeshLambertMaterial({ color: i % 2 ? 0x3f8a52 : 0x4a9e5f }),
          );
          this.segments.push(seg);
          this.segmentPos.push(new THREE.Vector3());
        }
        break;
      }
      case 'dementor': {
        const rig = buildAvatar({ body: 0x26262e, legs: 0x26262e, hair: 0x1a1a22, scale: 1.1 });
        rig.legL.visible = false;
        rig.legR.visible = false;
        this.group.add(rig.group);
        const skirt = this.box(0.6, 0.9, 0.4, 0x1e1e28, 0, 0.35, 0); // tattered robe
        skirt.rotation.z = 0.06;
        break;
      }
      case 'deatheater': {
        const rig = buildAvatar({ body: 0x26262e, legs: 0x1a1a22, hair: 0x111118, hat: 0x111118, scale: 1.0 });
        this.group.add(rig.group);
        break;
      }
      case 'voldemort': {
        const rig = buildAvatar({ body: 0x1a1a22, legs: 0x111118, hair: 0x2a3a2e, scale: 1.3 });
        this.group.add(rig.group);
        this.box(0.07, 0.6, 0.07, 0x3a3a4e, 0.45, 1.5, 0.2); // his wand
        break;
      }
    }
  }

  /** Axis-aligned slab test; returns ray t or null. */
  rayHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number | null {
    const [hw, h] = this.def.size;
    const minX = this.pos.x - hw, maxX = this.pos.x + hw;
    const minY = this.pos.y, maxY = this.pos.y + h;
    const minZ = this.pos.z - hw, maxZ = this.pos.z + hw;
    let tmin = 0, tmax = 60;
    for (const [o, d, lo, hi] of [[ox, dx, minX, maxX], [oy, dy, minY, maxY], [oz, dz, minZ, maxZ]] as const) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) return null;
      } else {
        let t1 = (lo - o) / d, t2 = (hi - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    return tmin;
  }

  hit(damage: number, knockFrom: THREE.Vector3): boolean {
    this.hp -= damage;
    this.flash = 0.15;
    for (const m of this.mats) m.emissive.setHex(0xffffff);
    this.bar.draw(this.hp / this.maxHp);
    const dx = this.pos.x - knockFrom.x, dz = this.pos.z - knockFrom.z;
    const len = Math.hypot(dx, dz) || 1;
    this.vel.x += (dx / len) * 6;
    this.vel.z += (dz / len) * 6;
    if (this.hp <= 0) this.dead = true;
    return this.dead;
  }

  update(dt: number, ctx: EnemyCtx): void {
    this.time += dt;
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) for (const m of this.mats) m.emissive.setHex(0x000000);
    }
    if (this.stunned > 0) {
      this.stunned -= dt;
      this.group.position.copy(this.pos);
      this.group.position.y += Math.sin(this.time * 8) * 0.05;
      return;
    }
    this.attackCooldown -= dt;

    const world = ctx.world();
    const toPlayer = new THREE.Vector3().subVectors(ctx.playerPos, this.pos);
    const dist = Math.hypot(toPlayer.x, toPlayer.z);
    const chasing = dist < this.def.aggro;

    // knockback decay
    this.vel.multiplyScalar(Math.max(0, 1 - 8 * dt));
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    let speed = this.def.speed;
    if (this.kind === 'werewolf' && ctx.isNight()) speed *= 1.3;
    if (this.kind === 'slime') speed *= Math.max(0, Math.sin(this.time * 4)) > 0.3 ? 1.6 : 0; // hops

    if (this.kind === 'voldemort') {
      this.teleportCooldown -= dt;
      this.shootCooldown -= dt;
      if (this.teleportCooldown <= 0 && dist > 4) {
        this.teleportCooldown = 6;
        const angle = Math.random() * Math.PI * 2;
        const r = 6 + Math.random() * 6;
        this.pos.set(ctx.playerPos.x + Math.cos(angle) * r, this.pos.y, ctx.playerPos.z + Math.sin(angle) * r);
        ctx.burst(this.pos.x, this.pos.y + 1, this.pos.z, 0x6a3aa4, 14);
      }
      if (this.shootCooldown <= 0) {
        this.shootCooldown = 3;
        ctx.fireAtPlayer(this.pos, 3);
      }
      const frac = this.hp / this.maxHp;
      if (frac < 0.66 && this.summonedAt.indexOf(66) < 0) { this.summonedAt.push(66); ctx.summon('dementor', 2, this.pos); }
      if (frac < 0.33 && this.summonedAt.indexOf(33) < 0) { this.summonedAt.push(33); ctx.summon('deatheater', 2, this.pos); }
    }

    if (this.kind === 'deatheater') {
      this.shootCooldown -= dt;
      if (chasing && this.shootCooldown <= 0 && dist < 26) {
        this.shootCooldown = 2.5 + Math.random() * 1.5;
        ctx.fireAtPlayer(this.pos, 1);
      }
      // keep wand distance: approach to ~10, back off under 6
      if (dist < 6) speed = -speed * 0.8;
      else if (dist < 10) speed = 0;
    }

    if (chasing && speed !== 0 && dist > 0.3) {
      const stepX = (toPlayer.x / dist) * speed * dt;
      const stepZ = (toPlayer.z / dist) * speed * dt;
      const nx = this.pos.x + stepX, nz = this.pos.z + stepZ;
      if (this.def.flyer) {
        this.pos.x = nx;
        this.pos.z = nz;
      } else {
        const footY = Math.floor(this.pos.y + 0.1);
        const blockAhead = world.get(Math.floor(nx), footY, Math.floor(nz));
        const blockAbove = world.get(Math.floor(nx), footY + 1, Math.floor(nz));
        const water = world.get(Math.floor(nx), footY, Math.floor(nz)) === WATER || world.get(Math.floor(nx), footY - 1, Math.floor(nz)) === WATER;
        if (water) {
          // walkers refuse the sea
        } else if (!isSolid(blockAhead)) {
          this.pos.x = nx; this.pos.z = nz;
        } else if (!isSolid(blockAbove) && !isSolid(world.get(Math.floor(nx), footY + 2, Math.floor(nz)))) {
          this.pos.x = nx; this.pos.z = nz; this.pos.y += 1; // step up
        }
      }
      this.heading = lerpAngle(this.heading, Math.atan2(toPlayer.x, toPlayer.z), Math.min(1, 8 * dt));
    }

    // vertical
    if (this.def.flyer) {
      const ground = groundBelow(world, this.pos.x, this.pos.y + 1.5, this.pos.z);
      const hover = (ground >= 0 ? ground + 1 : this.pos.y) + (this.kind === 'pixie' ? 2.2 : 2.8) + Math.sin(this.time * 2) * 0.4;
      const targetY = chasing ? Math.max(ctx.playerPos.y + 0.6, hover - 1.6) : hover;
      this.pos.y += (targetY - this.pos.y) * Math.min(1, 2.5 * dt);
    } else {
      const ground = groundBelow(world, this.pos.x, this.pos.y + 1.2, this.pos.z);
      if (ground >= 0) this.pos.y += (ground + 1 - this.pos.y) * Math.min(1, 12 * dt);
      if (this.kind === 'slime') this.pos.y += Math.max(0, Math.sin(this.time * 4)) * 0.5;
    }

    // bite / bonk
    if (this.def.damage > 0 && dist < this.def.attackRange && Math.abs(ctx.playerPos.y - this.pos.y) < 2.2 && this.attackCooldown <= 0) {
      this.attackCooldown = 1.2;
      ctx.damagePlayer(this.def.damage, this.def.label);
    }

    // dementors drain from a distance (handled in main for the screen effect)

    // animate
    if (this.kind === 'slime') this.group.scale.y = 1 + Math.sin(this.time * 4) * 0.15;
    for (let i = 0; i < this.wings.length; i++) this.wings[i].rotation.z = Math.sin(this.time * 18) * 0.6 * (i ? 1 : -1);
    for (let i = 0; i < this.legs.length; i++) this.legs[i].rotation.z = Math.sin(this.time * 8 + i) * 0.25 * (i % 2 ? 1 : -1);
    if (this.kind === 'dementor') this.group.position.y = this.pos.y + Math.sin(this.time * 1.5) * 0.2;

    // basilisk: drag the tail
    if (this.segments.length) {
      let prev = this.pos;
      for (let i = 0; i < this.segments.length; i++) {
        const target = this.segmentPos[i];
        if (target.lengthSq() === 0) target.copy(prev);
        target.lerp(prev, Math.min(1, 6 * dt));
        const back = new THREE.Vector3().subVectors(target, prev).normalize().multiplyScalar(1.0);
        if (back.lengthSq() > 0) target.copy(prev).add(back);
        this.segments[i].position.set(target.x, target.y + 0.5, target.z);
        prev = target;
      }
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.group);
    for (const seg of this.segments) scene.add(seg);
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.group);
    for (const seg of this.segments) scene.remove(seg);
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry?.dispose();
    });
    for (const seg of this.segments) seg.geometry.dispose();
  }
}

interface Bolt {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  ttl: number;
  friendly?: boolean;
}

export class EnemyManager {
  enemies: Enemy[] = [];
  bolts: Bolt[] = [];
  private spawnTimer = 0;
  private boltGeo = new THREE.SphereGeometry(0.2, 6, 6);
  private boltMat = new THREE.MeshBasicMaterial({ color: 0xa44ae0 });

  constructor(private scene: THREE.Scene) {}

  alive(kind?: EnemyKind): number {
    return this.enemies.filter((e) => !e.dead && (!kind || e.kind === kind)).length;
  }

  spawn(kind: EnemyKind, x: number, y: number, z: number, shadow = false): Enemy {
    const enemy = new Enemy(kind, shadow);
    enemy.pos.set(x, y, z);
    enemy.addToScene(this.scene);
    this.enemies.push(enemy);
    return enemy;
  }

  /** Keep `want` enemies of `kind` alive near the player (outside safe zones). */
  maintain(
    kind: EnemyKind,
    want: number,
    dt: number,
    ctx: EnemyCtx,
    isSafe: (x: number, z: number) => boolean,
    shadow = false,
  ): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || this.alive() >= want) return;
    this.spawnTimer = 0.6;
    const world = ctx.world();
    const angle = Math.random() * Math.PI * 2;
    const r = 16 + Math.random() * 22;
    const x = Math.floor(ctx.playerPos.x + Math.cos(angle) * r);
    const z = Math.floor(ctx.playerPos.z + Math.sin(angle) * r);
    if (x < 2 || z < 2 || x > world.sizeX - 3 || z > world.sizeZ - 3) return;
    if (isSafe(x, z)) return;
    const y = world.surfaceY(x, z);
    if (y < 9) return; // no sea spawns
    this.spawn(kind, x + 0.5, y + 1, z + 0.5, shadow);
  }

  fireBolt(from: THREE.Vector3, toward: THREE.Vector3, spread = 0, friendly = false): void {
    const dir = new THREE.Vector3().subVectors(toward, from).normalize();
    if (spread) {
      const angle = Math.atan2(dir.x, dir.z) + (Math.random() - 0.5) * spread;
      const horiz = Math.hypot(dir.x, dir.z);
      dir.x = Math.sin(angle) * horiz;
      dir.z = Math.cos(angle) * horiz;
    }
    const mesh = new THREE.Mesh(this.boltGeo, friendly ? new THREE.MeshBasicMaterial({ color: 0xf0a6e8 }) : this.boltMat);
    mesh.position.copy(from).add(new THREE.Vector3(0, 1.4, 0));
    this.scene.add(mesh);
    this.bolts.push({ mesh, vel: dir.multiplyScalar(7), ttl: 5, friendly });
  }

  update(dt: number, ctx: EnemyCtx): void {
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.update(dt, ctx);
      // despawn the wandered-off (never bosses)
      if (enemy.kind !== 'voldemort' && enemy.kind !== 'basilisk' && enemy.pos.distanceTo(ctx.playerPos) > 70) {
        enemy.dead = true;
        enemy.removeFromScene(this.scene);
      }
    }
    // sweep defeated
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.dead) continue;
      if (enemy.hp <= 0) {
        ctx.burst(enemy.pos.x, enemy.pos.y + 1, enemy.pos.z, enemy.def.poofColor, 16);
        ctx.burst(enemy.pos.x, enemy.pos.y + 1, enemy.pos.z, 0xffd24a, 8);
        ctx.onDefeated(enemy.kind, enemy.pos.clone());
        enemy.removeFromScene(this.scene);
      }
      this.enemies.splice(i, 1);
    }
    // bolts
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bolt = this.bolts[i];
      bolt.ttl -= dt;
      bolt.mesh.position.addScaledVector(bolt.vel, dt);
      const p = bolt.mesh.position;
      let gone = bolt.ttl <= 0 || isSolid(ctx.world().get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)));
      if (!gone && !bolt.friendly) {
        const d = Math.hypot(p.x - ctx.playerPos.x, p.z - ctx.playerPos.z);
        if (d < 0.8 && p.y > ctx.playerPos.y - 0.2 && p.y < ctx.playerPos.y + 2) {
          ctx.damagePlayer(1, 'a dark bolt');
          gone = true;
        }
      }
      if (gone) {
        ctx.burst(p.x, p.y, p.z, 0xa44ae0, 4);
        this.scene.remove(bolt.mesh);
        this.bolts.splice(i, 1);
      }
    }
  }

  /** The crosshair ray vs every enemy; nearest hit beyond the camera-player gap. */
  rayHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, minT: number): { enemy: Enemy; t: number } | null {
    let best: { enemy: Enemy; t: number } | null = null;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const t = enemy.rayHit(ox, oy, oz, dx, dy, dz);
      if (t !== null && t > minT && (!best || t < best.t)) best = { enemy, t };
    }
    return best;
  }

  repelDementors(from: THREE.Vector3, radius: number): number {
    let repelled = 0;
    for (const enemy of this.enemies) {
      if (enemy.kind !== 'dementor' || enemy.dead) continue;
      if (enemy.pos.distanceTo(from) < radius) {
        enemy.stunned = 5;
        enemy.hit(2, from);
        repelled++;
      }
    }
    return repelled;
  }

  clear(): void {
    for (const enemy of this.enemies) enemy.removeFromScene(this.scene);
    this.enemies.length = 0;
    for (const bolt of this.bolts) this.scene.remove(bolt.mesh);
    this.bolts.length = 0;
  }
}
