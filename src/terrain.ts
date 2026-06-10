import { World, SIZE, HEIGHT } from './world';
import { AIR, WATER, CRYSTAL as CRYSTAL_ID, LANTERN as LANTERN_ID, BRICK } from './blocks';

export const WATER_Y = 8; // sea level (top water block)

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
  const rand = mulberry32(seed);
  const fbm = makeNoise(rand);
  world.data.fill(AIR);

  const heights = new Int8Array(SIZE * SIZE);

  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) {
      // radial falloff makes a round-ish island with sea around it
      const d = Math.hypot(x - 31.5, z - 31.5) / 28;
      const mask = Math.max(0, 1 - d * d * d);
      const n = fbm(x * 0.07 + 100, z * 0.07 + 100);
      const h = Math.min(30, Math.floor(2 + (3 + n * 15) * mask));
      heights[x + z * SIZE] = h;

      for (let y = 0; y <= h; y++) {
        let id: number;
        if (y === 0 || y < h - 2) id = STONE;
        else if (y < h) id = EARTH;
        else id = h <= WATER_Y + 1 ? SAND : MEADOW; // beaches near the water line
        world.set(x, y, z, id);
      }
      for (let y = h + 1; y <= WATER_Y; y++) world.set(x, y, z, WATER);
    }
  }

  const surfaceIs = (x: number, z: number, id: number) =>
    world.get(x, heights[x + z * SIZE], z) === id;

  // trees
  const trees: Array<[number, number]> = [];
  for (let i = 0; i < 60 && trees.length < 12; i++) {
    const x = 4 + Math.floor(rand() * (SIZE - 8));
    const z = 4 + Math.floor(rand() * (SIZE - 8));
    const h = heights[x + z * SIZE];
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
  for (let i = 0, placed = 0; i < 50 && placed < 7; i++) {
    const x = 3 + Math.floor(rand() * (SIZE - 6));
    const z = 3 + Math.floor(rand() * (SIZE - 6));
    const h = heights[x + z * SIZE];
    if (h <= WATER_Y || world.get(x, h + 1, z) !== AIR) continue;
    world.set(x, h + 1, z, CRYSTAL);
    if (rand() < 0.5) world.set(x + 1, h + 1, z, CRYSTAL);
    if (rand() < 0.35) world.set(x, h + 2, z, CRYSTAL);
    if (rand() < 0.4) world.set(x, h + 1, z + 1, LANTERN);
    placed++;
  }

  // blossom bushes
  for (let i = 0, placed = 0; i < 40 && placed < 7; i++) {
    const x = 3 + Math.floor(rand() * (SIZE - 6));
    const z = 3 + Math.floor(rand() * (SIZE - 6));
    const h = heights[x + z * SIZE];
    if (h <= WATER_Y + 1 || !surfaceIs(x, z, MEADOW)) continue;
    if (world.get(x, h + 1, z) !== AIR) continue;
    world.set(x, h + 1, z, BLOSSOM);
    placed++;
  }
}

/**
 * Builds the mysterious stone ring on the island (once) and returns its gate.
 * Called only when no portal location is stored in the save.
 */
export function buildIslandPortal(world: World): Gate {
  const fx = 46, fz = 32; // east side of the island
  const h = Math.min(13, Math.max(WATER_Y + 2, world.surfaceY(fx + 2, fz)));

  // flatten a small clearing
  for (let x = fx - 2; x <= fx + 7; x++) {
    for (let z = fz - 4; z <= fz + 4; z++) {
      for (let y = 1; y <= h; y++) {
        if (world.get(x, y, z) !== STONE || y >= h - 2) world.set(x, y, z, y < h ? EARTH : MEADOW);
      }
      for (let y = h + 1; y <= h + 9; y++) world.set(x, y, z, AIR);
    }
  }

  // the ring: two pillars, a beam, crystals on top, lanterns at the feet
  for (let y = h + 1; y <= h + 4; y++) {
    world.set(fx, y, fz, BRICK);
    world.set(fx + 4, y, fz, BRICK);
  }
  for (let x = fx; x <= fx + 4; x++) world.set(x, h + 5, fz, BRICK);
  world.set(fx, h + 6, fz, CRYSTAL_ID);
  world.set(fx + 4, h + 6, fz, CRYSTAL_ID);
  world.set(fx + 2, h + 6, fz, CRYSTAL_ID);
  world.set(fx - 1, h + 1, fz, LANTERN_ID);
  world.set(fx + 5, h + 1, fz, LANTERN_ID);

  return { x: fx + 1, y: h + 1, z: fz };
}

/** A friendly spawn spot: meadow near the middle of the island. */
export function findSpawn(world: World): { x: number; y: number; z: number } {
  for (let r = 0; r < 26; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = 32 + dx, z = 32 + dz;
        const y = world.surfaceY(x, z);
        if (y > WATER_Y && world.get(x, y, z) === MEADOW && world.get(x, y + 1, z) === AIR && world.get(x, y + 2, z) === AIR) {
          return { x: x + 0.5, y: y + 1, z: z + 0.5 };
        }
      }
    }
  }
  return { x: 32.5, y: HEIGHT - 10, z: 32.5 };
}
