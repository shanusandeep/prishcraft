import * as THREE from 'three';
import { buildAvatar, AvatarRig } from './avatar';
import { groundBelow } from './npc';
import { World } from './world';
import { WATER_Y, mainIslandRadius } from './terrain';
import { WATER, AIR, isSolid } from './blocks';

// Like the castle friends, these names are for the family's private build —
// rename before sharing the game publicly.

export const ELF = {
  name: 'Pip',
  nameColor: '#3d8a5c',
  followLine: 'Pip follows! Pip is SO happy to help!',
  stayLine: 'Pip will wait right here. Pip promises!',
  lines: [
    'Pip can carry... well, Pip can carry encouragement!',
    'Master built that? Pip thinks it is MAGNIFICENT.',
  ],
};

export const MERMAID = {
  name: 'Marina',
  nameColor: '#2a8aa8',
  lines: [
    'Splash! A land-walker! Hello hello!',
    'Dream Crystals glow like pearls. Have you collected them all?',
    'The sea sings at night. I do the harmonies.',
    'I would trade my best seashell for legs like yours. Just for a day!',
  ],
};

/**
 * Pip the house elf: a tiny companion who obeys two commands —
 * follow (trots after you, even through the portal) and stay.
 */
export class Elf {
  def = ELF;
  group: THREE.Group;
  pos = new THREE.Vector3();
  lineIndex = 0;

  private rig: AvatarRig;
  private heading = 0;
  private walkTime = 0;

  constructor() {
    this.rig = buildAvatar({
      body: 0xd9c9a8, // little tunic
      legs: 0xc4b291,
      hair: 0xffe8d1, // bald and proud
      name: 'Pip',
      nameColor: ELF.nameColor,
      scale: 0.62,
      ears: true,
    });
    this.group = this.rig.group;
  }

  /** Pop to the player's side (after portal travel or when left far behind). */
  teleportTo(playerPos: THREE.Vector3): void {
    this.pos.set(playerPos.x + 1.2, playerPos.y, playerPos.z + 0.6);
  }

  update(dt: number, world: World, playerPos: THREE.Vector3, mode: 'follow' | 'stay'): void {
    const d = Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
    let moving = false;

    if (mode === 'follow') {
      if (d > 18) this.teleportTo(playerPos);
      else if (d > 2.2) {
        const dx = (playerPos.x - this.pos.x) / d;
        const dz = (playerPos.z - this.pos.z) / d;
        const step = Math.min(d - 2, 3.6 * dt);
        const nx = this.pos.x + dx * step;
        const nz = this.pos.z + dz * step;
        if (!isSolid(world.get(Math.floor(nx), Math.floor(this.pos.y + 0.1), Math.floor(nz)))) {
          this.pos.x = nx;
          this.pos.z = nz;
          moving = true;
        }
        this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), Math.min(1, 10 * dt));
      }
    }
    if (!moving && d < 5) {
      this.heading = lerpAngle(
        this.heading,
        Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z),
        Math.min(1, 6 * dt),
      );
    }

    const ground = groundBelow(world, this.pos.x, this.pos.y + 0.5, this.pos.z);
    if (ground >= 0) this.pos.y += (ground + 1 - this.pos.y) * Math.min(1, 12 * dt);

    this.walkTime += dt * (moving ? 6 : 1.5);
    const swing = Math.sin(this.walkTime * 3.5) * (moving ? 0.6 : 0.05);
    this.rig.armL.rotation.x = swing;
    this.rig.armR.rotation.x = -swing;
    this.rig.legL.rotation.x = -swing;
    this.rig.legR.rotation.x = swing;

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }
}

/** Marina the mermaid: bobs in the sea near the shore and chats. */
export class Mermaid {
  def = MERMAID;
  group = new THREE.Group();
  pos = new THREE.Vector3();
  lineIndex = 0;

  private time = Math.random() * 10;
  private home = new THREE.Vector3();
  private tail: THREE.Mesh;
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;

  constructor() {
    const teal = new THREE.MeshLambertMaterial({ color: 0x4ab8a8 });
    const tealDark = new THREE.MeshLambertMaterial({ color: 0x3a9890 });
    const cream = new THREE.MeshLambertMaterial({ color: 0xffe8d1 });
    const hair = new THREE.MeshLambertMaterial({ color: 0xe06a8a });
    const rig = buildAvatar({ body: 0x4ab8a8, legs: 0x4ab8a8, hair: 0xe06a8a, name: 'Marina', nameColor: MERMAID.nameColor });

    // borrow the avatar's head/body/arms, replace the legs with a tail
    this.group = rig.group;
    rig.legL.visible = false;
    rig.legR.visible = false;
    this.armL = rig.armL;
    this.armR = rig.armR;

    const tailGeo = new THREE.BoxGeometry(0.34, 0.6, 0.3);
    tailGeo.translate(0, -0.3, 0);
    this.tail = new THREE.Mesh(tailGeo, teal);
    this.tail.position.set(0, 0.66, 0);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.3), tealDark);
    fin.position.set(0, -0.62, 0.1);
    this.tail.add(fin);

    // long hair down the back
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.12), hair);
    lock.position.set(0, 1.25, -0.22);
    this.group.add(this.tail, lock);
    void cream;
  }

  /** Park her in the sea at the given spot. */
  setHome(x: number, z: number): void {
    this.home.set(x, 0, z);
    this.pos.set(x, WATER_Y - 0.8, z);
  }

  update(dt: number, _world: World, playerPos: THREE.Vector3): void {
    this.time += dt;
    // gentle bobbing, half out of the water
    this.pos.y = WATER_Y - 0.8 + Math.sin(this.time * 1.3) * 0.18;
    // drift in a small circle around home
    this.pos.x = this.home.x + Math.cos(this.time * 0.25) * 1.2;
    this.pos.z = this.home.z + Math.sin(this.time * 0.25) * 1.2;

    const d = this.pos.distanceTo(playerPos);
    if (d < 6) {
      this.group.rotation.y = Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
    } else {
      this.group.rotation.y = this.time * 0.25 + Math.PI / 2;
    }

    // little wave + tail sway
    const sway = Math.sin(this.time * 2.2);
    this.armL.rotation.x = 0.2 + sway * 0.15;
    this.armR.rotation.x = 0.2 - sway * 0.15;
    this.tail.rotation.x = 0.25 + sway * 0.12;

    this.group.position.copy(this.pos);
  }
}

/** A watery spot near the main island's shore for Marina. */
export function findMermaidSpot(world: World): { x: number; z: number } {
  const cx = world.sizeX / 2, cz = world.sizeZ / 2;
  const base = Math.round(mainIslandRadius(world.sizeX) * 0.93);
  for (const r of [base, base + 3, base - 3, base + 6]) {
    for (let a = 0; a < 48; a++) {
      const angle = (a / 48) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(angle) * r);
      const z = Math.round(cz + Math.sin(angle) * r);
      if (x < 2 || x > world.sizeX - 3 || z < 2 || z > world.sizeZ - 3) continue;
      if (world.get(x, WATER_Y, z) === WATER && world.get(x, WATER_Y + 1, z) === AIR) {
        return { x: x + 0.5, z: z + 0.5 };
      }
    }
  }
  return { x: 8.5, z: cz + 0.5 };
}

function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}
