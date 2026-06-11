import { World } from './world';
import { isTargetable } from './blocks';

export interface Hit {
  x: number; y: number; z: number;
  /** normal of the face that was hit (points toward the camera) */
  nx: number; ny: number; nz: number;
  id: number;
  /** distance along the ray where the hit happened */
  t: number;
}

/**
 * Voxel traversal (Amanatides–Woo). Steps cell by cell along the ray and
 * returns the first solid block, with the face it entered through.
 * Non-solid blocks (air, water) are passed through.
 */
export function raycastVoxels(
  world: World,
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxDist: number,
): Hit | null {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);

  const stepX = Math.sign(dx), stepY = Math.sign(dy), stepZ = Math.sign(dz);
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  let tMaxX = dx !== 0 ? (stepX > 0 ? x + 1 - ox : ox - x) / Math.abs(dx) : Infinity;
  let tMaxY = dy !== 0 ? (stepY > 0 ? y + 1 - oy : oy - y) / Math.abs(dy) : Infinity;
  let tMaxZ = dz !== 0 ? (stepZ > 0 ? z + 1 - oz : oz - z) / Math.abs(dz) : Infinity;

  let t = 0;
  let nx = 0, ny = 0, nz = 0;

  while (t <= maxDist) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX;
      nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY;
      nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ;
      nx = 0; ny = 0; nz = -stepZ;
    }
    const id = world.get(x, y, z);
    if (isTargetable(id)) return { x, y, z, nx, ny, nz, id, t };
  }
  return null;
}
