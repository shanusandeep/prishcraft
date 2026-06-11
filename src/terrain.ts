import { World, HEIGHT } from './world';
import { AIR, WATER, CRYSTAL as CRYSTAL_ID, LANTERN as LANTERN_ID, BRICK, WILDGRASS, VINE, CARROT, PUMPKIN, BUSH, SNOW, CHEST, TIMBER as TIMBER_ID, ROOF, PLANK } from './blocks';

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

/** A cozy cottage with floor at `baseY`, used by both villages. */
export function cottage(world: World, x0: number, z0: number, doorSide: 'E' | 'W', baseY: number): void {
  fillBox(world, x0 - 1, baseY + 1, z0 - 1, x0 + 6, baseY + 8, z0 + 6, AIR); // clear the plot
  fillBox(world, x0, baseY, z0, x0 + 5, baseY, z0 + 5, PLANK); // floor
  fillBox(world, x0, baseY + 1, z0, x0 + 5, baseY + 4, z0 + 5, PLANK); // shell
  fillBox(world, x0 + 1, baseY + 1, z0 + 1, x0 + 4, baseY + 4, z0 + 4, AIR); // hollow inside
  for (const [cx, cz] of [[x0, z0], [x0 + 5, z0], [x0, z0 + 5], [x0 + 5, z0 + 5]] as const) {
    fillBox(world, cx, baseY + 1, cz, cx, baseY + 4, cz, TIMBER_ID); // corner posts
  }
  const doorX = doorSide === 'E' ? x0 + 5 : x0;
  fillBox(world, doorX, baseY + 1, z0 + 2, doorX, baseY + 2, z0 + 3, AIR); // doorway
  world.set(x0 + 2, baseY + 2, z0, CRYSTAL_ID); // windows
  world.set(x0 + 3, baseY + 2, z0 + 5, CRYSTAL_ID);
  // stepped roof
  fillBox(world, x0 - 1, baseY + 5, z0 - 1, x0 + 6, baseY + 5, z0 + 6, ROOF);
  fillBox(world, x0, baseY + 6, z0, x0 + 5, baseY + 6, z0 + 5, ROOF);
  fillBox(world, x0 + 2, baseY + 7, z0 + 2, x0 + 3, baseY + 7, z0 + 3, ROOF);
  // cozy inside + pumpkin by the door
  world.set(x0 + 2, baseY + 4, z0 + 2, LANTERN_ID);
  fillBox(world, x0 + 1, baseY + 1, z0 + 4, x0 + 2, baseY + 1, z0 + 4, PLANK);
  const stepX = doorSide === 'E' ? doorX + 1 : doorX - 1;
  world.set(stepX, baseY + 1, z0 + 1, PUMPKIN);
}

/**
 * The spawn village + treasure chests, added once per island
 * (chests aren't placeable, so they make a reliable "already done" marker).
 * Two cottages flank the spot where you first appear, with chests to open,
 * and more chests hide all across the islands.
 */
export function treasurePass(
  world: World,
  spawn: { x: number; z: number },
  avoid: (x: number, z: number) => boolean,
): void {
  if (world.data.includes(CHEST)) return;
  const S = world.sizeX;
  const sx = Math.floor(spawn.x), sz = Math.floor(spawn.z);
  const h = world.surfaceY(sx, sz);

  const flatten = (x1: number, z1: number, x2: number, z2: number) => {
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) {
        for (let y = 1; y < h; y++) if (world.get(x, y, z) === AIR || world.get(x, y, z) === WATER) world.set(x, y, z, EARTH);
        world.set(x, h, z, MEADOW);
        for (let y = h + 1; y <= h + 10; y++) world.set(x, y, z, AIR);
      }
    }
  };

  // the home village
  flatten(sx + 5, sz - 4, sx + 12, sz + 3);
  cottage(world, sx + 6, sz - 3, 'W', h);
  flatten(sx - 12, sz - 4, sx - 5, sz + 3);
  cottage(world, sx - 11, sz - 3, 'E', h);
  // lamp posts and the village's own treasure
  for (const [lx, lz] of [[sx - 2, sz - 4], [sx + 2, sz - 4]] as const) {
    world.set(lx, h + 1, lz, TIMBER_ID);
    world.set(lx, h + 2, lz, LANTERN_ID);
  }
  world.set(sx + 3, h + 1, sz + 4, CHEST);
  world.set(sx - 3, h + 1, sz + 5, CHEST);

  // chests hidden across every island
  const target = Math.round(((S * S) / (64 * 64)) * 0.8) + 4;
  for (let i = 0, placed = 0; i < target * 30 && placed < target; i++) {
    const x = 3 + Math.floor(Math.random() * (S - 6));
    const z = 3 + Math.floor(Math.random() * (S - 6));
    if (avoid(x, z) || Math.hypot(x - sx, z - sz) < 20) continue;
    const y = world.surfaceY(x, z);
    if (y <= WATER_Y || world.get(x, y + 1, z) !== AIR) continue;
    world.set(x, y + 1, z, CHEST);
    placed++;
  }
}

/**
 * Builds the mysterious stone ring on the island (once) and returns its gate.
 * Called only when no portal location is stored in the save.
 */
export function buildIslandPortal(world: World): Gate {
  // east of the main island's center
  const fx = Math.floor(world.sizeX / 2) + 14;
  const fz = Math.floor(world.sizeZ / 2);
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
