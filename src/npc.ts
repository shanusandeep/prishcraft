import * as THREE from 'three';
import { buildAvatar, AvatarRig } from './avatar';
import { CharacterDef } from './characters';
import { World } from './world';
import { isSolid } from './blocks';

/** The floor directly under a point — not the roof above it. */
function groundBelow(world: World, x: number, y: number, z: number): number {
  const bx = Math.floor(x), bz = Math.floor(z);
  for (let by = Math.floor(y); by >= 0; by--) {
    if (isSolid(world.get(bx, by, bz))) return by;
  }
  return -1;
}

function darken(color: number, f = 0.65): number {
  const r = ((color >> 16) & 255) * f;
  const g = ((color >> 8) & 255) * f;
  const b = (color & 255) * f;
  return (r << 16) | (g << 8) | b;
}

/** A friendly castle character: wanders near home, looks at you, chats. */
export class NPC {
  group: THREE.Group;
  pos = new THREE.Vector3();
  lineIndex = 0;

  private rig: AvatarRig;
  private target: { x: number; z: number } | null = null;
  private wait = Math.random() * 3;
  private heading = Math.random() * Math.PI * 2;
  private walkTime = 0;

  constructor(public def: CharacterDef) {
    this.rig = buildAvatar({
      body: def.robe,
      legs: darken(def.robe),
      hair: def.hair,
      name: def.name,
      nameColor: def.nameColor,
    });
    this.group = this.rig.group;
    this.pos.set(def.spot[0], 13, def.spot[1]);
  }

  update(dt: number, world: World, playerPos: THREE.Vector3): void {
    const distToPlayer = this.pos.distanceTo(playerPos);
    let moving = false;

    if (this.target) {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.2) {
        this.target = null;
        this.wait = 3 + Math.random() * 5;
      } else {
        const step = Math.min(dist, 1.3 * dt);
        const nx = this.pos.x + (dx / dist) * step;
        const nz = this.pos.z + (dz / dist) * step;
        // don't walk into walls or furniture
        if (isSolid(world.get(Math.floor(nx), Math.floor(this.pos.y + 0.1), Math.floor(nz)))) {
          this.target = null;
          this.wait = 2 + Math.random() * 3;
        } else {
          this.pos.x = nx;
          this.pos.z = nz;
          this.faceToward(Math.atan2(dx, dz), dt);
          moving = true;
        }
      }
    } else if (distToPlayer > 4.5) {
      // don't wander off mid-conversation
      this.wait -= dt;
      if (this.wait <= 0) {
        this.target = {
          x: this.def.spot[0] + (Math.random() - 0.5) * 6,
          z: this.def.spot[1] + (Math.random() - 0.5) * 6,
        };
      }
    }

    // stay on the floor beneath us (not the roof above — they live indoors too)
    const ground = groundBelow(world, this.pos.x, this.pos.y + 0.5, this.pos.z);
    if (ground >= 0) this.pos.y += (ground + 1 - this.pos.y) * Math.min(1, 10 * dt);

    // look at the player when they come close
    if (distToPlayer < 4.5) {
      this.target = null;
      this.faceToward(Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z), dt);
    }

    this.walkTime += dt * (moving ? 4 : 1.2);
    const swing = Math.sin(this.walkTime * 3.5) * (moving ? 0.5 : 0.04);
    this.rig.armL.rotation.x = swing;
    this.rig.armR.rotation.x = -swing;
    this.rig.legL.rotation.x = -swing;
    this.rig.legR.rotation.x = swing;

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

  private faceToward(target: number, dt: number): void {
    let diff = target - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, 8 * dt);
  }
}
