import { World } from './world';
import { AIR, WATER, TIMBER, LEAF, CRYSTAL, LANTERN, BLOSSOM, BRICK, ROOF, PLANK, BOOKSHELF, PUMPKIN, CARROT, CHEST } from './blocks';
import { mulberry32, WATER_Y, cottage, Gate } from './terrain';

const NIGHTSTONE = 24, MARBLE = 23, SUNSTONE = 25;

const MEADOW = 1, EARTH = 2, STONE = 3, SAND = 4;

/** Where the return portal stands in the castle realm (inner gate min corner, 3w × 3h). */
export const CASTLE_GATE = { x: 31, y: 13, z: 14 };
/** Where you appear when you arrive from the island: inside the courtyard. */
export const CASTLE_SPAWN = { x: 32.5, y: 13, z: 20.5 };

function fill(world: World, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, id: number): void {
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      for (let z = z1; z <= z2; z++) world.set(x, y, z, id);
    }
  }
}

/** Where the dark portal stands in the castle courtyard once level 10 begins. */
export const CASTLE_SHADOW_GATE: Gate = { x: 41, y: 13, z: 21 };
/** The return gate inside the Shadow Realm. */
export const SHADOW_RETURN_GATE: Gate = { x: 31, y: 13, z: 8 };
export const SHADOW_SPAWN = { x: 32.5, y: 13, z: 11.5 };

/** Builds the dark portal in the castle courtyard (marked by Night Stone). */
export function ensureShadowGate(world: World): void {
  if (world.get(CASTLE_SHADOW_GATE.x - 1, CASTLE_SHADOW_GATE.y, CASTLE_SHADOW_GATE.z) === NIGHTSTONE) return;
  const g = CASTLE_SHADOW_GATE;
  for (let y = g.y; y <= g.y + 3; y++) {
    world.set(g.x - 1, y, g.z, NIGHTSTONE);
    world.set(g.x + 3, y, g.z, NIGHTSTONE);
  }
  for (let x = g.x - 1; x <= g.x + 3; x++) world.set(x, g.y + 3, g.z, NIGHTSTONE);
  fill(world, g.x, g.y, g.z, g.x + 2, g.y + 2, g.z, AIR);
}

/** The Shadow Realm: a dark plateau with Voldemort's broken arena. */
export function generateShadowRealm(world: World, seed: number): void {
  const rand = mulberry32(seed);
  world.data.fill(AIR);
  for (let x = 0; x < world.sizeX; x++) {
    for (let z = 0; z < world.sizeZ; z++) {
      const pd = Math.max(Math.abs(x - 32), Math.abs(z - 32));
      const h = pd <= 26 ? 12 : Math.max(2, 12 - (pd - 26) * 3);
      for (let y = 0; y <= h; y++) {
        world.set(x, y, z, y === h ? NIGHTSTONE : 3);
      }
      for (let y = h + 1; y <= WATER_Y; y++) world.set(x, y, z, WATER);
    }
  }
  // jagged dark spires
  for (let i = 0; i < 24; i++) {
    const x = 8 + Math.floor(rand() * 48), z = 8 + Math.floor(rand() * 48);
    if (Math.hypot(x - 32, z - 36) < 16) continue; // not in the arena
    const tall = 2 + Math.floor(rand() * 4);
    for (let y = 13; y < 13 + tall; y++) world.set(x, y, z, NIGHTSTONE);
    if (rand() < 0.4) world.set(x, 13 + tall, z, CRYSTAL);
  }
  // the arena: a broken ring of dark walls with a marble floor
  for (let dx = -14; dx <= 14; dx++) {
    for (let dz = -14; dz <= 14; dz++) {
      const d = Math.hypot(dx, dz);
      const x = 32 + dx, z = 36 + dz;
      if (d < 12) world.set(x, 12, z, MARBLE);
      if (d >= 12 && d < 13.5 && rand() < 0.8) {
        const tall = 2 + Math.floor(rand() * 3);
        for (let y = 13; y < 13 + tall; y++) world.set(x, y, z, NIGHTSTONE);
      }
    }
  }
  // his dais, with one stolen light
  fill(world, 30, 13, 44, 34, 13, 46, NIGHTSTONE);
  world.set(32, 14, 45, SUNSTONE);
  // the way home
  const r = SHADOW_RETURN_GATE;
  for (let y = 13; y <= 16; y++) {
    world.set(r.x - 1, y, r.z, BRICK);
    world.set(r.x + 3, y, r.z, BRICK);
  }
  for (let x = r.x - 1; x <= r.x + 3; x++) world.set(x, 16, r.z, BRICK);
  fill(world, r.x, 13, r.z, r.x + 2, 15, r.z, AIR);
  world.set(r.x - 1, 17, r.z, CRYSTAL);
  world.set(r.x + 3, 17, r.z, CRYSTAL);
}

/**
 * A tiny wizard village on the path to the castle: two cottages and a
 * market stall. Runs once per castle world (pumpkins are the marker).
 */
export function buildVillage(world: World): void {
  if (world.data.includes(PUMPKIN)) return;
  cottage(world, 19, 8, 'E', 12);
  cottage(world, 38, 8, 'W', 12);
  world.set(28, 13, 12, CHEST); // a little treasure between the cottages
  world.set(36, 13, 12, CHEST);
  // market stall by the path
  fill(world, 27, 13, 8, 29, 17, 10, AIR);
  for (const [px, pz] of [[27, 8], [29, 8], [27, 10], [29, 10]] as const) {
    fill(world, px, 13, pz, px, 15, pz, TIMBER);
  }
  fill(world, 26, 16, 7, 30, 16, 11, ROOF);
  fill(world, 27, 13, 10, 29, 13, 10, PLANK); // counter
  world.set(27, 14, 10, PUMPKIN);
  world.set(29, 14, 10, CARROT);
  world.set(28, 14, 10, LANTERN);
}

/**
 * The castle realm: a high plateau island with a walled castle on it —
 * four towers with spiral stairs, a great hall with a pitched roof,
 * a library, banners, and a courtyard with the return portal.
 */
export function generateCastleRealm(world: World, seed: number): void {
  const rand = mulberry32(seed);
  world.data.fill(AIR);

  // ---- plateau terrain (the castle realm is a compact 64x64) ----
  for (let x = 0; x < world.sizeX; x++) {
    for (let z = 0; z < world.sizeZ; z++) {
      const pd = Math.max(Math.abs(x - 32), Math.abs(z - 32));
      const h = pd <= 24 ? 12 : Math.max(2, 12 - (pd - 24) * 2);
      for (let y = 0; y <= h; y++) {
        let id: number;
        if (y === 0 || y < h - 2) id = STONE;
        else if (y < h) id = EARTH;
        else id = h <= WATER_Y + 1 ? SAND : MEADOW;
        world.set(x, y, z, id);
      }
      for (let y = h + 1; y <= WATER_Y; y++) world.set(x, y, z, WATER);
    }
  }

  // a ring of trees outside the walls
  for (let i = 0, planted = 0; i < 60 && planted < 8; i++) {
    const angle = rand() * Math.PI * 2;
    const r = 20 + rand() * 3;
    const x = Math.round(32 + Math.cos(angle) * r);
    const z = Math.round(32 + Math.sin(angle) * r);
    if (x < 4 || x > 59 || z < 4 || z > 59) continue;
    if (Math.abs(x - 32) < 5 && z < 24) continue; // keep the portal path clear
    if (world.get(x, 12, z) !== MEADOW) continue;
    for (let y = 13; y <= 16; y++) world.set(x, y, z, TIMBER);
    fill(world, x - 2, 15, z - 2, x + 2, 16, z + 2, LEAF);
    fill(world, x - 1, 17, z - 1, x + 1, 17, z + 1, LEAF);
    planted++;
  }

  // ---- perimeter walls (x 14..50, z 18..50) with battlements ----
  const wall = (x1: number, z1: number, x2: number, z2: number) => {
    fill(world, x1, 13, z1, x2, 17, z2, BRICK);
    fill(world, x1, 18, z1, x2, 18, z2, PLANK); // walkway
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) {
        if ((x + z) % 2 === 0) world.set(x, 19, z, BRICK); // battlements
      }
    }
  };
  wall(17, 18, 47, 18); // south (gate cut below)
  wall(17, 50, 47, 50); // north
  wall(14, 21, 14, 47); // west
  wall(50, 21, 50, 47); // east
  fill(world, 30, 13, 18, 34, 16, 18, AIR); // south gate archway

  // ---- four corner towers with spiral stairs ----
  const STAIR_RING: Array<[number, number]> = [
    [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0],
  ];
  const tower = (cx: number, cz: number, doorDz: number) => {
    fill(world, cx - 2, 13, cz - 2, cx + 2, 30, cz + 2, BRICK);
    fill(world, cx - 1, 13, cz - 1, cx + 1, 30, cz + 1, AIR); // hollow core
    // window slits
    for (const y of [17, 22, 27]) {
      world.set(cx - 2, y, cz, CRYSTAL);
      world.set(cx + 2, y, cz, CRYSTAL);
    }
    // door facing into the bailey
    fill(world, cx, 13, cz + doorDz * 2, cx, 15, cz + doorDz * 2, AIR);
    // spiral stairs: one block per step, climbing around the core
    for (let i = 0; i <= 16; i++) {
      const [dx, dz] = STAIR_RING[i % 8];
      world.set(cx + dx, 14 + i, cz + dz, PLANK);
    }
    world.set(cx, 20, cz, LANTERN); // a light floating mid-shaft
    // top platform with a hatch above the last stair
    fill(world, cx - 2, 31, cz - 2, cx + 2, 31, cz + 2, PLANK);
    world.set(cx + STAIR_RING[1][0], 31, cz + STAIR_RING[1][1], AIR); // hatch
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) === 2 && (dx + dz) % 2 === 0) {
          world.set(cx + dx, 32, cz + dz, BRICK); // parapet
        }
      }
    }
    fill(world, cx, 32, cz, cx, 35, cz, ROOF); // little spire
    world.set(cx, 36, cz, BLOSSOM); // flag!
  };
  tower(14, 18, 1);
  tower(50, 18, 1);
  tower(14, 50, -1);
  tower(50, 50, -1);

  // ---- the great hall (x 20..44, z 24..44) ----
  fill(world, 20, 12, 24, 44, 12, 44, PLANK); // floor
  fill(world, 20, 13, 24, 44, 22, 24, BRICK); // south wall
  fill(world, 20, 13, 44, 44, 22, 44, BRICK); // north wall
  fill(world, 20, 13, 24, 20, 22, 44, BRICK); // west wall
  fill(world, 44, 13, 24, 44, 22, 44, BRICK); // east wall
  fill(world, 31, 13, 24, 33, 16, 24, AIR); // grand door

  // windows
  for (const z of [27, 31, 35, 39, 43]) {
    fill(world, 20, 16, z, 20, 17, z, CRYSTAL);
    fill(world, 44, 16, z, 44, 17, z, CRYSTAL);
  }
  for (const x of [24, 28, 36, 40]) {
    fill(world, x, 16, 24, x, 17, 24, CRYSTAL);
    fill(world, x, 16, 44, x, 17, 44, CRYSTAL);
  }

  // pitched roof: strips stepping in 2 per level, gables filled at the ends
  for (let i = 0; i <= 6; i++) {
    const y = 23 + i;
    const left = 20 + 2 * i;
    const right = 44 - 2 * i;
    if (left >= right - 1) {
      fill(world, 31, y, 24, 33, y, 44, ROOF); // ridge
      break;
    }
    fill(world, left, y, 24, left + 1, y, 44, ROOF);
    fill(world, right - 1, y, 24, right, y, 44, ROOF);
    fill(world, left + 2, y, 24, right - 2, y, 24, BRICK); // south gable
    fill(world, left + 2, y, 44, right - 2, y, 44, BRICK); // north gable
  }

  // columns with lanterns
  for (const x of [26, 38]) {
    for (const z of [28, 32, 36, 40]) {
      fill(world, x, 13, z, x, 19, z, TIMBER);
      world.set(x, 20, z, LANTERN);
      fill(world, x, 21, z, x, 22, z, TIMBER);
    }
  }

  // long feast tables with candle lanterns
  fill(world, 28, 13, 27, 29, 13, 41, PLANK);
  fill(world, 35, 13, 27, 36, 13, 41, PLANK);
  for (const z of [30, 38]) {
    world.set(28, 14, z, LANTERN);
    world.set(36, 14, z, LANTERN);
  }

  // library corner (north-west): book-lined walls and a reading table
  fill(world, 21, 13, 43, 27, 16, 43, BOOKSHELF);
  fill(world, 21, 13, 38, 21, 16, 43, BOOKSHELF);
  world.set(22, 17, 43, LANTERN);
  fill(world, 23, 13, 39, 24, 13, 40, PLANK);

  // dais with crystals at the north end
  fill(world, 29, 13, 41, 35, 13, 42, PLANK);
  world.set(30, 14, 42, CRYSTAL);
  world.set(34, 14, 42, CRYSTAL);
  world.set(32, 14, 42, LANTERN);

  // banners on the inside of the south wall
  for (const x of [24, 28, 36, 40]) fill(world, x, 18, 25, x, 20, 25, BLOSSOM);

  // ---- courtyard path and lamp posts ----
  fill(world, 31, 12, 12, 33, 12, 23, PLANK);
  for (const [x, z] of [[29, 15], [35, 15], [29, 21], [35, 21]] as const) {
    world.set(x, 13, z, TIMBER);
    world.set(x, 14, z, LANTERN);
  }

  buildVillage(world);

  // ---- the return portal ----
  buildReturnPortal(world);
}

function buildReturnPortal(world: World): void {
  fill(world, 30, 13, 14, 30, 16, 14, BRICK);
  fill(world, 34, 13, 14, 34, 16, 14, BRICK);
  fill(world, 30, 16, 14, 34, 16, 14, BRICK);
  world.set(30, 16, 14, CRYSTAL);
  world.set(34, 16, 14, CRYSTAL);
  world.set(32, 17, 14, CRYSTAL);
  fill(world, 31, 13, 14, 33, 15, 14, AIR); // the gate itself
  world.set(29, 13, 14, LANTERN);
  world.set(35, 13, 14, LANTERN);
}
