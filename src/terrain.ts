import { World, HEIGHT } from './world';
import { AIR, WATER, CRYSTAL as CRYSTAL_ID, LANTERN as LANTERN_ID, BRICK, WILDGRASS, VINE, CARROT, PUMPKIN, BUSH, SNOW, CHEST, TIMBER as TIMBER_ID, ROOF, PLANK, BED, PAINTING, CHAIR, FEAST, TOILET, SINK, SHOWER } from './blocks';

const GLASS = 22, MARBLE = 23, SUNSTONE = 25, BOOKSHELF_ID = 14;

export const WATER_Y = 8; // sea level (top water block)

/** Radius of the big central island for a given world size. */
export function mainIslandRadius(size: number): number {
  return size <= 96 ? size * 0.42 : Math.min(90, size * 0.28);
}

const MEADOW = 1, EARTH = 2, STONE = 3, SAND = 4, TIMBER = 6, LEAF = 7, CRYSTAL = 8, LANTERN = 9, BLOSSOM = 10;

/** Inner gate of a portal ring: min corner of a 3-wide, 3-tall opening at one z plane. */
export interface Gate {
  x: number;
  y: number;
  z: number;
}

/** Small fast seeded PRNG so the same seed always grows the same island. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded 2D value noise + 3-octave fbm. */
function makeNoise(rand: () => number) {
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const lattice = (ix: number, iz: number) => perm[(ix + perm[iz & 255]) & 255] / 255;
  const noise = (x: number, z: number) => {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = lattice(ix, iz), b = lattice(ix + 1, iz);
    const c = lattice(ix, iz + 1), d = lattice(ix + 1, iz + 1);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  };
  return (x: number, z: number) => {
    let sum = 0, amp = 0.5, freq = 1;
    for (let o = 0; o < 3; o++) {
      sum += amp * noise(x * freq, z * freq);
      amp *= 0.5;
      freq *= 2;
    }
    return sum / 0.875; // back to ~[0,1]
  };
}

export function generateIsland(world: World, seed: number): void {
  const S = world.sizeX;
  const rand = mulberry32(seed);
  const fbm = makeNoise(rand);
  world.data.fill(AIR);

  // one big home island, plus a scattering of small islands to fly to
  const islets: Array<{ x: number; z: number; r: number }> = [
    { x: S / 2, z: S / 2, r: mainIslandRadius(S) },
  ];
  if (S >= 128) {
    const count = Math.round(S / 24);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.8;
      const minD = mainIslandRadius(S) + 18;
      const maxD = S / 2 - 14;
      const dist = minD + rand() * Math.max(4, maxD - minD);
      islets.push({
        x: S / 2 + Math.cos(angle) * dist,
        z: S / 2 + Math.sin(angle) * dist,
        r: 9 + rand() * 8,
      });
    }
  }

  const heights = new Int8Array(S * S);

  for (let x = 0; x < S; x++) {
    for (let z = 0; z < S; z++) {
      let mask = 0;
      for (const islet of islets) {
        const d = Math.hypot(x - islet.x, z - islet.z) / islet.r;
        mask = Math.max(mask, 1 - d * d * d);
      }
      const n = fbm(x * 0.07 + 100, z * 0.07 + 100);
      const h = Math.min(30, Math.floor(2 + (3 + n * 15) * mask));
      heights[x + z * S] = h;

      for (let y = 0; y <= h; y++) {
        let id: number;
        if (y === 0 || y < h - 2) id = STONE;
        else if (y < h) id = EARTH;
        else if (h >= 24) id = SNOW; // snowy peaks
        else id = h <= WATER_Y + 1 ? SAND : MEADOW; // beaches near the water line
        world.set(x, y, z, id);
      }
      for (let y = h + 1; y <= WATER_Y; y++) world.set(x, y, z, WATER);
    }
  }

  const surfaceIs = (x: number, z: number, id: number) =>
    world.get(x, heights[x + z * S], z) === id;
  const area = (S * S) / (64 * 64); // feature counts scale with the map

  // trees
  const trees: Array<[number, number]> = [];
  const treeTarget = Math.round(12 * area);
  for (let i = 0; i < treeTarget * 6 && trees.length < treeTarget; i++) {
    const x = 4 + Math.floor(rand() * (S - 8));
    const z = 4 + Math.floor(rand() * (S - 8));
    const h = heights[x + z * S];
    if (h <= WATER_Y + 1 || !surfaceIs(x, z, MEADOW)) continue;
    if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 5)) continue;
    trees.push([x, z]);

    const trunkTop = h + 4;
    for (let y = h + 1; y <= trunkTop; y++) world.set(x, y, z, TIMBER);
    for (let dy = -1; dy <= 0; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && rand() < 0.6) continue;
          const y = trunkTop + dy;
          if (world.get(x + dx, y, z + dz) === AIR) world.set(x + dx, y, z + dz, LEAF);
        }
      }
    }
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (world.get(x + dx, trunkTop + 1, z + dz) === AIR) world.set(x + dx, trunkTop + 1, z + dz, LEAF);
    }
  }

  // crystal clusters with the occasional star lantern
  const crystalTarget = Math.round(7 * area);
  for (let i = 0, placed = 0; i < crystalTarget * 8 && placed < crystalTarget; i++) {
    const x = 3 + Math.floor(rand() * (S - 6));
    const z = 3 + Math.floor(rand() * (S - 6));
    const h = heights[x + z * S];
    if (h <= WATER_Y || world.get(x, h + 1, z) !== AIR) continue;
    world.set(x, h + 1, z, CRYSTAL);
    if (rand() < 0.5) world.set(x + 1, h + 1, z, CRYSTAL);
    if (rand() < 0.35) world.set(x, h + 2, z, CRYSTAL);
    if (rand() < 0.4) world.set(x, h + 1, z + 1, LANTERN);
    placed++;
  }

  // blossom bushes
  const blossomTarget = Math.round(7 * area);
  for (let i = 0, placed = 0; i < blossomTarget * 6 && placed < blossomTarget; i++) {
    const x = 3 + Math.floor(rand() * (S - 6));
    const z = 3 + Math.floor(rand() * (S - 6));
    const h = heights[x + z * S];
    if (h <= WATER_Y + 1 || !surfaceIs(x, z, MEADOW)) continue;
    if (world.get(x, h + 1, z) !== AIR) continue;
    world.set(x, h + 1, z, BLOSSOM);
    placed++;
  }
}

/** A big friendly willow: tall trunk, wide canopy, drooping vine strands. */
export function plantWillow(world: World, x: number, z: number, h: number): void {
  const top = h + 5;
  for (let y = h + 1; y <= top; y++) world.set(x, y, z, TIMBER);
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const r = Math.max(Math.abs(dx), Math.abs(dz));
      if (r === 3 && (Math.abs(dx) + Math.abs(dz) > 4 || Math.random() < 0.3)) continue;
      if (world.get(x + dx, top + 1, z + dz) === AIR) world.set(x + dx, top + 1, z + dz, LEAF);
      if (r <= 1 && world.get(x + dx, top + 2, z + dz) === AIR) world.set(x + dx, top + 2, z + dz, LEAF);
      // drooping strands from the canopy rim
      if (r >= 2 && Math.random() < 0.6) {
        const len = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < len; k++) {
          if (world.get(x + dx, top - k, z + dz) !== AIR) break;
          world.set(x + dx, top - k, z + dz, VINE);
        }
      }
    }
  }
}

/**
 * Adds grass tufts and willow trees to a world that doesn't have them yet
 * (fresh islands AND old saves alike). `avoid` masks out areas like the
 * portal clearing or the castle footprint.
 */
export function floraPass(
  world: World,
  willows: number,
  avoid: (x: number, z: number) => boolean,
): void {
  if (world.data.includes(WILDGRASS)) return; // already done
  const S = world.sizeX;

  for (let x = 1; x < S - 1; x++) {
    for (let z = 1; z < S - 1; z++) {
      const y = world.surfaceY(x, z);
      if (y <= WATER_Y || world.get(x, y, z) !== MEADOW) continue;
      if (world.get(x, y + 1, z) !== AIR || avoid(x, z)) continue;
      const roll = Math.random();
      if (roll < 0.12) world.set(x, y + 1, z, WILDGRASS);
      else if (roll < 0.132) world.set(x, y + 1, z, BUSH);
    }
  }

  for (let i = 0, planted = 0; i < 80 && planted < willows; i++) {
    const x = 5 + Math.floor(Math.random() * (S - 10));
    const z = 5 + Math.floor(Math.random() * (S - 10));
    if (avoid(x, z)) continue;
    const h = world.surfaceY(x, z);
    if (h <= WATER_Y + 1) continue;
    const surface = world.get(x, h, z);
    if (surface !== MEADOW && surface !== WILDGRASS) continue;
    let clear = true;
    for (let y = h + 1; y <= h + 8 && clear; y++) {
      if (world.get(x, y, z) !== AIR && world.get(x, y, z) !== WILDGRASS) clear = false;
    }
    if (!clear) continue;
    if (world.get(x, h, z) === WILDGRASS) world.set(x, h, z, AIR);
    plantWillow(world, x, z, world.surfaceY(x, z));
    planted++;
  }
}

/**
 * Little carrot-and-pumpkin fields on the island meadow. Runs once per world
 * (skips if any carrot already exists), so old saves get fields too.
 */
export function cropsPass(world: World, avoid: (x: number, z: number) => boolean): void {
  if (world.data.includes(CARROT)) return;
  const S = world.sizeX;
  const fieldTarget = S <= 96 ? 3 : 8;

  for (let i = 0, fields = 0; i < fieldTarget * 30 && fields < fieldTarget; i++) {
    const x0 = 4 + Math.floor(Math.random() * (S - 12));
    const z0 = 4 + Math.floor(Math.random() * (S - 12));
    if (avoid(x0, z0)) continue;
    const h = world.surfaceY(x0, z0);
    if (h <= WATER_Y + 1 || world.get(x0, h, z0) !== MEADOW) continue;
    // needs a flat 5x4 patch
    let flat = true;
    for (let dx = 0; dx < 5 && flat; dx++) {
      for (let dz = 0; dz < 4 && flat; dz++) {
        if (world.surfaceY(x0 + dx, z0 + dz) !== h) flat = false;
        const top = world.get(x0 + dx, h, z0 + dz);
        if (top !== MEADOW && top !== WILDGRASS) flat = false;
      }
    }
    if (!flat) continue;

    for (let dx = 0; dx < 5; dx++) {
      for (let dz = 0; dz < 4; dz++) {
        const x = x0 + dx, z = z0 + dz;
        world.set(x, h + 1, z, AIR); // clear tufts
        if (dx === 0 || dx === 4 || dz === 0 || dz === 3) continue; // grass border
        world.set(x, h, z, EARTH); // tilled soil
        if (Math.random() < 0.8) world.set(x, h + 1, z, CARROT);
      }
    }
    world.set(x0, h + 1, z0, PUMPKIN);
    world.set(x0 + 4, h + 1, z0 + 3, PUMPKIN);
    fields++;
  }
}

function fillBox(world: World, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, id: number): void {
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      for (let z = z1; z <= z2; z++) world.set(x, y, z, id);
    }
  }
}

export type DoorSide = 'E' | 'W' | 'N' | 'S';

/**
 * A BIG wizard family home: 9x9, two tall stories, an underground basement,
 * a real dining set, 2-block beds with side tables, rugs, paintings,
 * bookshelves — and a proper glass-walled bathroom.
 */
export function cottage(
  world: World,
  x0: number,
  z0: number,
  doorSide: DoorSide,
  baseY: number,
  wall = PLANK,
): void {
  const x1 = x0 + 8, z1 = z0 + 8;
  const ROSE = 29, MINT = 27;
  fillBox(world, x0 - 1, baseY + 1, z0 - 1, x1 + 1, baseY + 16, z1 + 1, AIR); // clear the plot

  // ---- basement: big storage room dug below the house ----
  fillBox(world, x0 + 1, baseY - 4, z0 + 1, x1 - 1, baseY - 4, z1 - 1, PLANK); // floor
  fillBox(world, x0 + 1, baseY - 3, z0 + 1, x1 - 1, baseY - 1, z1 - 1, AIR); // room
  world.set(x0 + 1, baseY - 3, z1 - 1, CHEST);
  world.set(x0 + 2, baseY - 3, z1 - 1, CHEST);
  world.set(x1 - 1, baseY - 3, z1 - 1, PUMPKIN);
  world.set(x1 - 1, baseY - 3, z1 - 2, PUMPKIN);
  world.set(x0 + 1, baseY - 1, z0 + 4, LANTERN_ID);
  world.set(x1 - 1, baseY - 1, z0 + 4, LANTERN_ID);
  // climbing blocks back up the shaft
  world.set(x0 + 2, baseY - 3, z0 + 1, PLANK);
  world.set(x0 + 1, baseY - 2, z0 + 1, PLANK);

  // ---- ground floor (walls 5 tall — roomy!) ----
  fillBox(world, x0, baseY, z0, x1, baseY, z1, PLANK); // floor
  fillBox(world, x0 + 3, baseY, z0 + 3, x1 - 3, baseY, z1 - 3, ROSE); // a cozy rug
  world.set(x0 + 1, baseY, z0 + 2, AIR); // basement hatch (hop down!)
  fillBox(world, x0, baseY + 1, z0, x1, baseY + 5, z1, wall); // walls
  fillBox(world, x0 + 1, baseY + 1, z0 + 1, x1 - 1, baseY + 5, z1 - 1, AIR); // hollow
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) {
    fillBox(world, cx, baseY + 1, cz, cx, baseY + 11, cz, TIMBER_ID); // tall corner posts
  }
  // dining room: a REAL table (2x2) with feast spread and four chairs
  fillBox(world, x0 + 3, baseY + 1, z0 + 3, x0 + 4, baseY + 1, z0 + 4, PLANK);
  world.set(x0 + 3, baseY + 2, z0 + 3, FEAST);
  world.set(x0 + 4, baseY + 2, z0 + 4, FEAST);
  world.set(x0 + 2, baseY + 1, z0 + 3, CHAIR);
  world.set(x0 + 5, baseY + 1, z0 + 4, CHAIR);
  world.set(x0 + 3, baseY + 1, z0 + 2, CHAIR);
  world.set(x0 + 4, baseY + 1, z0 + 5, CHAIR);
  // library wall + art + lights
  fillBox(world, x0 + 1, baseY + 1, z1 - 1, x0 + 3, baseY + 2, z1 - 1, BOOKSHELF_ID);
  world.set(x0 + 5, baseY + 3, z1 - 1, PAINTING);
  world.set(x0 + 2, baseY + 3, z0 + 1, PAINTING);
  world.set(x0 + 4, baseY + 5, z0 + 4, LANTERN_ID);
  world.set(x1 - 1, baseY + 1, z0 + 1, PUMPKIN); // kitchen corner
  world.set(x1 - 2, baseY + 1, z0 + 1, FEAST);
  // stairs up along the east wall (5 steps for the taller floor)
  for (let s = 0; s < 5; s++) world.set(x1 - 1, baseY + 1 + s, z1 - 1 - s, PLANK);

  // ---- second floor ----
  fillBox(world, x0, baseY + 6, z0, x1, baseY + 6, z1, PLANK); // floor
  fillBox(world, x0 + 3, baseY + 6, z0 + 4, x1 - 3, baseY + 6, z1 - 3, MINT); // bedroom rug
  fillBox(world, x1 - 1, baseY + 6, z1 - 7, x1 - 1, baseY + 6, z1 - 5, AIR); // stair opening
  fillBox(world, x0, baseY + 7, z0, x1, baseY + 11, z1, wall); // walls
  fillBox(world, x0 + 1, baseY + 7, z0 + 1, x1 - 1, baseY + 11, z1 - 1, AIR); // hollow
  // bedroom: THREE proper 2-block beds, side tables, lanterns
  for (const bz of [z0 + 1, z0 + 4, z0 + 7] as const) {
    world.set(x0 + 1, baseY + 7, bz, BED);
    world.set(x0 + 2, baseY + 7, bz, BED);
    if (bz !== z0 + 7) {
      world.set(x0 + 1, baseY + 7, bz + 1, PLANK); // side table
      world.set(x0 + 1, baseY + 8, bz + 1, LANTERN_ID);
    }
  }
  world.set(x0 + 4, baseY + 9, z0 + 1, PAINTING);
  world.set(x0 + 1, baseY + 7, z1 - 1, CHEST);
  world.set(x0 + 4, baseY + 11, z0 + 4, LANTERN_ID);
  // the BATHROOM (very important): toilet, sink, double shower behind glass
  world.set(x1 - 1, baseY + 7, z0 + 1, TOILET);
  world.set(x1 - 2, baseY + 7, z0 + 1, SINK);
  world.set(x1 - 1, baseY + 7, z0 + 2, SHOWER);
  world.set(x1 - 1, baseY + 8, z0 + 2, SHOWER);
  world.set(x1 - 1, baseY + 7, z0 + 3, SHOWER);
  fillBox(world, x1 - 3, baseY + 7, z0 + 1, x1 - 3, baseY + 9, z0 + 3, GLASS);
  fillBox(world, x1 - 2, baseY + 7, z0 + 4, x1 - 1, baseY + 9, z0 + 4, GLASS);
  world.set(x1 - 2, baseY + 7, z0 + 4, AIR); // bathroom doorway

  // windows on both floors, two per wall (skip the door wall downstairs)
  for (const wx of [x0 + 2, x1 - 2] as const) {
    if (doorSide !== 'N') { world.set(wx, baseY + 2, z0, CRYSTAL_ID); world.set(wx, baseY + 3, z0, CRYSTAL_ID); world.set(wx, baseY + 8, z0, CRYSTAL_ID); }
    if (doorSide !== 'S') { world.set(wx, baseY + 2, z1, CRYSTAL_ID); world.set(wx, baseY + 3, z1, CRYSTAL_ID); world.set(wx, baseY + 8, z1, CRYSTAL_ID); }
  }
  for (const wz of [z0 + 2, z1 - 2] as const) {
    if (doorSide !== 'W') { world.set(x0, baseY + 2, wz, CRYSTAL_ID); world.set(x0, baseY + 3, wz, CRYSTAL_ID); world.set(x0, baseY + 8, wz, CRYSTAL_ID); }
    if (doorSide !== 'E') { world.set(x1, baseY + 2, wz, CRYSTAL_ID); world.set(x1, baseY + 3, wz, CRYSTAL_ID); world.set(x1, baseY + 8, wz, CRYSTAL_ID); }
  }

  // stepped roof
  fillBox(world, x0 - 1, baseY + 12, z0 - 1, x1 + 1, baseY + 12, z1 + 1, ROOF);
  fillBox(world, x0, baseY + 13, z0, x1, baseY + 13, z1, ROOF);
  fillBox(world, x0 + 2, baseY + 14, z0 + 2, x1 - 2, baseY + 14, z1 - 2, ROOF);
  fillBox(world, x0 + 4, baseY + 15, z0 + 4, x1 - 4, baseY + 15, z1 - 4, ROOF);

  // the doorway: 2 wide, 3 tall — grand! (cleared last)
  if (doorSide === 'E') fillBox(world, x1, baseY + 1, z0 + 3, x1, baseY + 3, z0 + 4, AIR);
  if (doorSide === 'W') fillBox(world, x0, baseY + 1, z0 + 3, x0, baseY + 3, z0 + 4, AIR);
  if (doorSide === 'N') fillBox(world, x0 + 3, baseY + 1, z0, x0 + 4, baseY + 3, z0, AIR);
  if (doorSide === 'S') fillBox(world, x0 + 3, baseY + 1, z1, x0 + 4, baseY + 3, z1, AIR);
  // lanterns and a pumpkin by the door
  const front: Record<DoorSide, [number, number, number, number]> = {
    E: [x1 + 1, z0 + 2, x1 + 1, z0 + 5], W: [x0 - 1, z0 + 2, x0 - 1, z0 + 5],
    N: [x0 + 2, z0 - 1, x0 + 5, z0 - 1], S: [x0 + 2, z1 + 1, x0 + 5, z1 + 1],
  };
  const [lx1, lz1, lx2, lz2] = front[doorSide];
  world.set(lx1, baseY + 1, lz1, LANTERN_ID);
  world.set(lx2, baseY + 1, lz2, PUMPKIN);
}

/**
 * The Burrow: a tall, gloriously crooked tower-house, each floor offset
 * and a different cozy color, beds everywhere, chimneys, the works.
 */
export function buildBurrow(world: World, bx: number, bz: number, baseY: number): void {
  const WALLS = [PLANK, 27, 29, 28]; // plank, mint, rose, sky
  const offs: Array<[number, number]> = [[0, 0], [1, 0], [0, 1], [-1, 0]];
  fillBox(world, bx - 3, baseY + 1, bz - 3, bx + 10, baseY + 30, bz + 10, AIR);

  for (let floor = 0; floor < 4; floor++) {
    const fy = baseY + floor * 5;
    const ox = bx + offs[floor][0], oz = bz + offs[floor][1];
    fillBox(world, ox, fy, oz, ox + 6, fy, oz + 6, PLANK); // floor slab (7x7 now)
    fillBox(world, ox, fy + 1, oz, ox + 6, fy + 4, oz + 6, WALLS[floor]); // walls
    fillBox(world, ox + 1, fy + 1, oz + 1, ox + 5, fy + 4, oz + 5, AIR); // hollow
    // windows + lantern + proper 2-block beds
    world.set(ox, fy + 2, oz + 2, CRYSTAL_ID);
    world.set(ox, fy + 3, oz + 2, CRYSTAL_ID);
    world.set(ox + 6, fy + 2, oz + 4, CRYSTAL_ID);
    world.set(ox + 6, fy + 3, oz + 4, CRYSTAL_ID);
    world.set(ox + 3, fy + 4, oz + 3, LANTERN_ID);
    world.set(ox + 1, fy + 1, oz + 1, BED);
    world.set(ox + 2, fy + 1, oz + 1, BED);
    if (floor > 0) {
      world.set(ox + 4, fy + 1, oz + 5, BED);
      world.set(ox + 5, fy + 1, oz + 5, BED);
      world.set(ox + 3, fy + 1, oz + 1, PLANK); // side table
      world.set(ox + 3, fy + 2, oz + 1, LANTERN_ID);
    }
    if (floor === 1) { // family room: a real table, chairs, art
      fillBox(world, ox + 2, fy + 1, oz + 3, ox + 3, fy + 1, oz + 3, PLANK);
      world.set(ox + 2, fy + 2, oz + 3, FEAST);
      world.set(ox + 3, fy + 2, oz + 3, FEAST);
      world.set(ox + 1, fy + 1, oz + 3, CHAIR);
      world.set(ox + 4, fy + 1, oz + 3, CHAIR);
      world.set(ox + 2, fy + 3, oz + 5, PAINTING);
      world.set(ox + 5, fy + 1, oz + 1, BOOKSHELF_ID);
    }
    if (floor === 2) { // the bathroom floor
      world.set(ox + 5, fy + 1, oz + 1, TOILET);
      world.set(ox + 4, fy + 1, oz + 1, SINK);
      world.set(ox + 5, fy + 1, oz + 2, SHOWER);
      world.set(ox + 5, fy + 2, oz + 2, SHOWER);
      fillBox(world, ox + 4, fy + 1, oz + 3, ox + 5, fy + 2, oz + 3, GLASS);
    }
    // stairs up inside (alternating corner)
    if (floor < 3) {
      const sx = floor % 2 === 0 ? ox + 5 : ox + 1;
      world.set(sx, fy + 1, oz + 2, PLANK);
      world.set(sx, fy + 2, oz + 3, PLANK);
      world.set(sx, fy + 3, oz + 4, PLANK);
      world.set(sx, fy + 4, oz + 5, PLANK);
      // opening in the floor above
      world.set(sx, fy + 5, oz + 5, AIR);
      world.set(sx, fy + 5, oz + 4, AIR);
    }
  }
  // pointy roof + two crooked chimneys
  const top = baseY + 20;
  fillBox(world, bx - 2, top, bz - 2, bx + 8, top, bz + 8, ROOF);
  fillBox(world, bx - 1, top + 1, bz - 1, bx + 7, top + 1, bz + 7, ROOF);
  fillBox(world, bx + 1, top + 2, bz + 1, bx + 5, top + 2, bz + 5, ROOF);
  fillBox(world, bx + 3, top + 3, bz + 3, bx + 4, top + 3, bz + 4, ROOF);
  fillBox(world, bx, top + 1, bz, bx, top + 5, bz, BRICK);
  fillBox(world, bx + 6, top + 1, bz + 6, bx + 6, top + 6, bz + 6, BRICK);
  world.set(bx + 6, top + 7, bz + 6, LANTERN_ID);
  // grand front door (south) + welcome lanterns and pumpkins
  fillBox(world, bx + 2, baseY + 1, bz, bx + 4, baseY + 3, bz, AIR);
  world.set(bx + 1, baseY + 1, bz - 1, LANTERN_ID);
  world.set(bx + 5, baseY + 1, bz - 1, PUMPKIN);
}

/** The eight family-cottage plots, spaced for the BIG 9x9 two-story houses. */
export function villagePlots(sx: number, sz: number): Array<{ x: number; z: number; door: DoorSide }> {
  return [
    { x: sx + 8, z: sz + 3, door: 'N' },
    { x: sx + 20, z: sz + 3, door: 'N' },
    { x: sx - 17, z: sz + 3, door: 'N' },
    { x: sx - 29, z: sz + 3, door: 'N' },
    { x: sx + 8, z: sz - 12, door: 'S' },
    { x: sx + 20, z: sz - 12, door: 'S' },
    { x: sx - 17, z: sz - 12, door: 'S' },
    { x: sx - 29, z: sz - 12, door: 'S' },
  ];
}

/** Where the Burrow stands, off the village's south-east corner. */
export function burrowSpot(sx: number, sz: number): { x: number; z: number } {
  return { x: sx + 17, z: sz - 28 };
}

/**
 * A whole village around the spawn point: a plaza with a well, plank
 * streets in all four directions, eight colorful two-story cottages,
 * the Burrow, a duel green, a farm, a market stall, lamp posts,
 * villagers' chests — plus treasure chests hidden all across the
 * islands. Built once per fresh island.
 */
export function treasurePass(
  world: World,
  spawn: { x: number; z: number },
  avoid: (x: number, z: number) => boolean,
): void {
  if (world.data.includes(CHEST)) return;
  renovateVillage(world, spawn, avoid);
  scatterChests(world, spawn, avoid);
}

/** Chests hidden across every island (separate so renovations don't re-scatter). */
export function scatterChests(
  world: World,
  spawn: { x: number; z: number },
  avoid: (x: number, z: number) => boolean,
): void {
  const S = world.sizeX;
  const sx = Math.floor(spawn.x), sz = Math.floor(spawn.z);
  const target = Math.round(((S * S) / (64 * 64)) * 0.8) + 4;
  for (let i = 0, placed = 0; i < target * 30 && placed < target; i++) {
    const x = 3 + Math.floor(Math.random() * (S - 6));
    const z = 3 + Math.floor(Math.random() * (S - 6));
    if (avoid(x, z) || Math.hypot(x - sx, z - sz) < 36) continue;
    const y = world.surfaceY(x, z);
    if (y <= WATER_Y || world.get(x, y + 1, z) !== AIR) continue;
    world.set(x, y + 1, z, CHEST);
    placed++;
  }
}

/**
 * Builds (or REBUILDS) the whole spawn village with the big 9x9 houses.
 * Also used to renovate villages on old saves — it clears the housing
 * bands first so no slivers of the old small cottages remain.
 */
export function renovateVillage(
  world: World,
  spawn: { x: number; z: number },
  avoid: (x: number, z: number) => boolean,
): void {
  const sx = Math.floor(spawn.x), sz = Math.floor(spawn.z);
  const h = world.surfaceY(sx, sz);
  const COZY = [PLANK, 27, 28, 29]; // cottage wall palettes

  const flatten = (x1: number, z1: number, x2: number, z2: number, top = MEADOW) => {
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) {
        for (let y = 1; y < h; y++) {
          const id = world.get(x, y, z);
          if (id === AIR || id === WATER) world.set(x, y, z, EARTH);
        }
        world.set(x, h, z, top);
        for (let y = h + 1; y <= h + 12; y++) world.set(x, y, z, AIR);
      }
    }
  };

  // ---- plaza with a wishing well (offset so you don't spawn inside it) ----
  flatten(sx - 5, sz - 5, sx + 5, sz + 5);
  const wx = sx - 3, wz = sz - 3;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) world.set(wx + dx, h + 1, wz + dz, WATER);
      else world.set(wx + dx, h + 1, wz + dz, BRICK);
    }
  }
  world.set(wx - 1, h + 2, wz - 1, LANTERN_ID);
  world.set(wx + 1, h + 2, wz + 1, LANTERN_ID);

  // ---- streets ----
  // demolition first: clear the housing bands so old small cottages
  // (from saves made before the renovation) leave no slivers behind
  flatten(sx - 31, sz + 2, sx + 31, sz + 13);
  flatten(sx - 31, sz - 14, sx + 31, sz - 3);

  const street = (x1: number, z1: number, x2: number, z2: number) => flatten(x1, z1, x2, z2, PLANK);
  street(sx + 6, sz - 1, sx + 31, sz);
  street(sx - 31, sz - 1, sx - 6, sz);
  street(sx - 1, sz + 6, sx, sz + 24);
  street(sx - 1, sz - 24, sx, sz - 6);

  // lamp posts at the street ends and plaza corners
  for (const [lx, lz] of [
    [sx + 31, sz + 1], [sx - 31, sz + 1], [sx + 1, sz + 24], [sx + 1, sz - 24],
    [sx - 5, sz - 5], [sx + 5, sz + 5],
  ] as const) {
    world.set(lx, h + 1, lz, TIMBER_ID);
    world.set(lx, h + 2, lz, LANTERN_ID);
  }

  // ---- eight family cottages along the streets (9x9, two-story) ----
  const plots = villagePlots(sx, sz);
  plots.forEach((plot, i) => {
    if (avoid(plot.x + 4, plot.z + 4)) return;
    flatten(plot.x - 1, plot.z - 1, plot.x + 9, plot.z + 9);
    cottage(world, plot.x, plot.z, plot.door, h, COZY[i % COZY.length]);
  });

  // ---- the Burrow (the Weasleys' crooked tower) ----
  const bw = burrowSpot(sx, sz);
  flatten(bw.x - 3, bw.z - 3, bw.x + 10, bw.z + 10);
  buildBurrow(world, bw.x, bw.z, h);

  // ---- the village green: duel ring, feast tables, benches ----
  const gx = sx - 19, gz = sz + 17;
  flatten(gx - 7, gz - 7, gx + 7, gz + 7);
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const d = Math.hypot(dx, dz);
      if (d <= 5.6 && d >= 4.4) world.set(gx + dx, h, gz + dz, BRICK); // the ring
      else if (d < 4.4) world.set(gx + dx, h, gz + dz, PLANK); // the stage
    }
  }
  for (const [lx, lz] of [[gx - 6, gz - 6], [gx + 6, gz - 6], [gx - 6, gz + 6], [gx + 6, gz + 6]] as const) {
    world.set(lx, h + 1, lz, TIMBER_ID);
    world.set(lx, h + 2, lz, LANTERN_ID);
    world.set(lx, h + 3, lz, BLOSSOM); // banner flags
  }
  // feast row at the edge of the green
  for (let i = 0; i < 4; i++) {
    world.set(gx - 3 + i * 2, h + 1, gz - 7, FEAST);
    world.set(gx - 3 + i * 2, h + 1, gz - 8, CHAIR);
  }
  world.set(gx - 6, h + 1, gz - 7, CHEST);
  world.set(gx + 6, h + 1, gz - 7, CHEST);

  // ---- the farm ----
  flatten(sx + 9, sz + 12, sx + 15, sz + 17);
  for (let x = sx + 10; x <= sx + 14; x++) {
    for (let z = sz + 13; z <= sz + 16; z++) {
      world.set(x, h, z, EARTH);
      if (Math.random() < 0.8) world.set(x, h + 1, z, CARROT);
    }
  }
  world.set(sx + 9, h + 1, sz + 12, PUMPKIN);
  world.set(sx + 15, h + 1, sz + 17, PUMPKIN);

  // ---- the market stall ----
  flatten(sx - 12, sz + 8, sx - 8, sz + 12);
  for (const [px, pz] of [[sx - 11, sz + 9], [sx - 9, sz + 9], [sx - 11, sz + 11], [sx - 9, sz + 11]] as const) {
    fillBox(world, px, h + 1, pz, px, h + 3, pz, TIMBER_ID);
  }
  fillBox(world, sx - 12, h + 4, sz + 8, sx - 8, h + 4, sz + 12, ROOF);
  fillBox(world, sx - 11, h + 1, sz + 11, sx - 9, h + 1, sz + 11, PLANK);
  world.set(sx - 11, h + 2, sz + 11, PUMPKIN);
  world.set(sx - 10, h + 2, sz + 11, LANTERN_ID);
  world.set(sx - 9, h + 2, sz + 11, CARROT);

  // ---- village treasure ----
  world.set(sx + 4, h + 1, sz - 4, CHEST);
  world.set(sx - 4, h + 1, sz + 4, CHEST);
  world.set(sx + 24, h + 1, sz + 2, CHEST);

}

/**
 * Builds the mysterious stone ring on the island (once) and returns its gate.
 * Called only when no portal location is stored in the save.
 */
export function buildIslandPortal(world: World): Gate {
  // east of the main island's center — an abandoned, mossy ruin
  const fx = Math.floor(world.sizeX / 2) + 14;
  const fz = Math.floor(world.sizeZ / 2);
  const h = Math.min(13, Math.max(WATER_Y + 2, world.surfaceY(fx + 2, fz)));

  // flatten a generous clearing
  for (let x = fx - 6; x <= fx + 11; x++) {
    for (let z = fz - 7; z <= fz + 7; z++) {
      for (let y = 1; y <= h; y++) {
        if (world.get(x, y, z) !== STONE || y >= h - 2) world.set(x, y, z, y < h ? EARTH : MEADOW);
      }
      for (let y = h + 1; y <= h + 26; y++) world.set(x, y, z, AIR);
    }
  }

  // the working arch: thick double pillars, beam, crystals
  for (let y = h + 1; y <= h + 4; y++) {
    world.set(fx, y, fz, BRICK);
    world.set(fx - 1, y, fz, BRICK);
    world.set(fx + 4, y, fz, BRICK);
    world.set(fx + 5, y, fz, BRICK);
  }
  for (let x = fx - 1; x <= fx + 5; x++) world.set(x, h + 5, fz, BRICK);
  world.set(fx, h + 6, fz, CRYSTAL_ID);
  world.set(fx + 4, h + 6, fz, CRYSTAL_ID);
  world.set(fx + 2, h + 6, fz, CRYSTAL_ID);
  world.set(fx - 1, h + 1, fz, LANTERN_ID);
  world.set(fx + 5, h + 1, fz, LANTERN_ID);

  // a second, collapsed arch behind it — clearly a ruin
  for (let y = h + 1; y <= h + 3; y++) world.set(fx - 1, y, fz + 3, BRICK);
  world.set(fx - 1, h + 4, fz + 3, MARBLE);
  world.set(fx + 5, h + 1, fz + 3, BRICK);
  world.set(fx + 5, h + 2, fz + 3, BRICK);
  // fallen rubble and mossy stones
  const rubble = [BRICK, STONE, MARBLE, BRICK, STONE];
  for (let i = 0; i < 14; i++) {
    const rx = fx + 2 + Math.round((Math.random() - 0.5) * 12);
    const rz = fz + Math.round((Math.random() - 0.5) * 11);
    if (Math.abs(rz - fz) < 2 && rx >= fx - 1 && rx <= fx + 5) continue; // keep the gate clear
    if (world.get(rx, h + 1, rz) === AIR) {
      world.set(rx, h + 1, rz, rubble[i % rubble.length]);
      if (Math.random() < 0.4 && world.get(rx, h + 2, rz) === AIR) world.set(rx, h + 2, rz, Math.random() < 0.5 ? BUSH : WILDGRASS);
    }
  }
  for (let i = 0; i < 10; i++) {
    const rx = fx + 2 + Math.round((Math.random() - 0.5) * 10);
    const rz = fz + Math.round((Math.random() - 0.5) * 9);
    if (world.get(rx, h + 1, rz) === AIR) world.set(rx, h + 1, rz, WILDGRASS);
  }

  // the findability fix: a tall beam of ancient light above the arch
  for (let y = h + 6; y <= h + 22; y++) world.set(fx + 2, y, fz, SUNSTONE);

  return { x: fx + 1, y: h + 1, z: fz };
}

/** A friendly spawn spot: meadow near the middle of the main island. */
export function findSpawn(world: World): { x: number; y: number; z: number } {
  const cx = Math.floor(world.sizeX / 2), cz = Math.floor(world.sizeZ / 2);
  for (let r = 0; r < 26; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = cx + dx, z = cz + dz;
        const y = world.surfaceY(x, z);
        if (y > WATER_Y && world.get(x, y, z) === MEADOW && world.get(x, y + 1, z) === AIR && world.get(x, y + 2, z) === AIR) {
          return { x: x + 0.5, y: y + 1, z: z + 0.5 };
        }
      }
    }
  }
  return { x: cx + 0.5, y: HEIGHT - 10, z: cz + 0.5 };
}
