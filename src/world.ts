import { AIR } from './blocks';

export const HEIGHT = 64;

const STONE = 3;

/**
 * A whole realm is one flat Uint8Array of block ids,
 * indexed as x + z*sizeX + y*sizeX*sizeZ. Worlds can differ in footprint:
 * the island realm is large, the castle realm is a compact 64x64.
 */
export class World {
  data: Uint8Array;

  constructor(public sizeX = 64, public sizeZ = 64) {
    this.data = new Uint8Array(sizeX * HEIGHT * sizeZ);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.sizeX && z >= 0 && z < this.sizeZ && y >= 0 && y < HEIGHT;
  }

  get(x: number, y: number, z: number): number {
    if (y < 0) return STONE; // endless magic bedrock, also culls bottom faces
    if (x < 0 || x >= this.sizeX || z < 0 || z >= this.sizeZ || y >= HEIGHT) return AIR;
    return this.data[x + z * this.sizeX + y * this.sizeX * this.sizeZ];
  }

  set(x: number, y: number, z: number, id: number): void {
    if (!this.inBounds(x, y, z)) return;
    this.data[x + z * this.sizeX + y * this.sizeX * this.sizeZ] = id;
  }

  /** Highest non-air, non-water block at a column, or -1. */
  surfaceY(x: number, z: number): number {
    for (let y = HEIGHT - 1; y >= 0; y--) {
      const id = this.get(x, y, z);
      if (id !== AIR && id !== 5) return y;
    }
    return -1;
  }
}
