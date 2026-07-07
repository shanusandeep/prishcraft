import * as THREE from 'three';
import { World } from './world';
import { isSolid, WATER } from './blocks';
import { buildAvatar, AvatarRig } from './avatar';

export interface MoveInput {
  x: number; // strafe: -1..1
  z: number; // forward: -1..1
  jump: boolean;
  down: boolean; // descend while flying
}

const EPS = 0.001;

function solidAt(world: World, x: number, y: number, z: number): boolean {
  // invisible walls at the map border so nobody falls off the edge of the world
  if (x < 0 || x >= world.sizeX || z < 0 || z >= world.sizeZ) return true;
  return isSolid(world.get(x, y, z));
}

export class Player {
  pos = new THREE.Vector3(); // feet, centered on x/z
  vel = new THREE.Vector3();
  onGround = false;
  inWater = false;
  flying = false;
  readonly width = 0.6;
  readonly height = 1.7;

  group: THREE.Group;
  private rig: AvatarRig;
  private wand: THREE.Group;
  private broom: THREE.Group;
  private heading = 0;
  private walkTime = 0;

  constructor() {
    this.rig = buildAvatar({ body: 0xb9a8ee, legs: 0x8d7ad6, hair: 0x6e5aa8 });
    this.group = this.rig.group;

    // wand in the right hand — visible once crafted
    this.wand = new THREE.Group();
    const stick = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.5, 0.07),
      new THREE.MeshLambertMaterial({ color: 0xa87c52 }),
    );
    stick.position.y = -0.1;
    const tip = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.13, 0.13),
      new THREE.MeshBasicMaterial({ color: 0xf0a6e8 }),
    );
    tip.position.y = 0.18;
    this.wand.add(stick, tip);
    this.wand.position.set(0, -0.5, 0.15);
    this.wand.rotation.x = -0.5;
    this.wand.visible = false;
    this.rig.armR.add(this.wand);

    // broom under the player — visible while flying
    this.broom = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 1.7),
      new THREE.MeshLambertMaterial({ color: 0xc09368 }),
    );
    const bristles = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.3, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xf6e3a8 }),
    );
    bristles.position.z = -1.0;
    this.broom.add(handle, bristles);
    this.broom.position.y = 0.35;
    this.broom.visible = false;
    this.group.add(this.broom);
  }

  setWandVisible(on: boolean): void {
    this.wand.visible = on;
  }

  /** The Star Blade upgrade: the wand blazes silver. */
  setStarblade(on: boolean): void {
    const [stick, tip] = this.wand.children as THREE.Mesh[];
    if (!stick || !tip) return;
    (stick.material as THREE.MeshLambertMaterial).color.setHex(on ? 0x3a3a4e : 0xa87c52);
    (tip.material as THREE.MeshBasicMaterial).color.setHex(on ? 0xd9e4f0 : 0xf0a6e8);
  }

  setFlying(on: boolean): void {
    this.flying = on;
    this.broom.visible = on;
    if (on) this.vel.y = Math.max(this.vel.y, 0);
  }

  update(dt: number, input: MoveInput, camYaw: number, world: World): void {
    const feet = world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    this.inWater = feet === WATER;

    // desired horizontal velocity in camera space
    const speed = this.flying ? 7.5 : this.inWater ? 2.4 : 4.5;
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw); // forward
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw); // right
    let mx = fx * input.z + rx * input.x;
    let mz = fz * input.z + rz * input.x;
    const mlen = Math.hypot(mx, mz);
    if (mlen > 1) { mx /= mlen; mz /= mlen; }

    const accel = this.flying ? 14 : this.onGround ? 22 : 10;
    this.vel.x += (mx * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (mz * speed - this.vel.z) * Math.min(1, accel * dt);

    if (this.flying) {
      // broom mode: no gravity, rise and sink on command
      const targetY = input.jump ? 5.5 : input.down ? -5.5 : 0;
      this.vel.y += (targetY - this.vel.y) * Math.min(1, 12 * dt);
    } else {
      this.vel.y -= (this.inWater ? 7 : 24) * dt;
      this.vel.y = Math.max(this.vel.y, this.inWater ? -3 : -30);
      if (input.jump) {
        if (this.inWater) this.vel.y = 3.4;
        else if (this.onGround) this.vel.y = 8.2;
      }
    }

    // integrate one axis at a time, resolving collisions after each
    this.onGround = false;
    this.pos.x += this.vel.x * dt;
    this.resolveAxis(world, 'x');
    this.pos.y += this.vel.y * dt;
    this.resolveAxis(world, 'y');
    this.pos.z += this.vel.z * dt;
    this.resolveAxis(world, 'z');

    // touching down while sinking ends the broom ride
    if (this.flying && this.onGround && input.down) this.setFlying(false);

    // face the direction of travel, with a soft turn
    if (mlen > 0.05) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let diff = target - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, 14 * dt);
    }

    // walk cycle (gentler in the air)
    const planar = Math.hypot(this.vel.x, this.vel.z);
    this.walkTime += dt * (2 + planar * 2.2);
    const amp = this.flying ? 0.15 : Math.min(0.7, planar * 0.2);
    const swing = Math.sin(this.walkTime * 4) * amp;
    this.rig.armL.rotation.x = swing;
    this.rig.armR.rotation.x = -swing;
    this.rig.legL.rotation.x = this.flying ? 0.5 : -swing;
    this.rig.legR.rotation.x = this.flying ? 0.5 : swing;

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

  intersectsBlock(bx: number, by: number, bz: number): boolean {
    const hw = this.width / 2;
    return (
      bx + 1 > this.pos.x - hw && bx < this.pos.x + hw &&
      bz + 1 > this.pos.z - hw && bz < this.pos.z + hw &&
      by + 1 > this.pos.y && by < this.pos.y + this.height
    );
  }

  private resolveAxis(world: World, axis: 'x' | 'y' | 'z'): void {
    const hw = this.width / 2;
    const minX = Math.floor(this.pos.x - hw), maxX = Math.floor(this.pos.x + hw);
    const minY = Math.floor(this.pos.y), maxY = Math.floor(this.pos.y + this.height);
    const minZ = Math.floor(this.pos.z - hw), maxZ = Math.floor(this.pos.z + hw);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (!solidAt(world, x, y, z)) continue;
          if (axis === 'x') {
            if (this.vel.x > 0) this.pos.x = x - hw - EPS;
            else if (this.vel.x < 0) this.pos.x = x + 1 + hw + EPS;
            this.vel.x = 0;
          } else if (axis === 'z') {
            if (this.vel.z > 0) this.pos.z = z - hw - EPS;
            else if (this.vel.z < 0) this.pos.z = z + 1 + hw + EPS;
            this.vel.z = 0;
          } else {
            if (this.vel.y > 0) this.pos.y = y - this.height - EPS;
            else if (this.vel.y < 0) {
              this.pos.y = y + 1 + EPS;
              this.onGround = true;
            }
            this.vel.y = 0;
          }
        }
      }
    }
  }
}
