import { AIR } from './blocks';

export const SIZE = 64;
export const HEIGHT = 64;

const STONE = 3;

/**
 * The whole island is one flat Uint8Array of block ids,
 * indexed as x + z*SIZE + y*SIZE*SIZE. 64x48x64 = ~196 KB.
 */
export class World {
  data = new Uint8Array(SIZE * HEIGHT * SIZE);

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < SIZE && z >= 0 && z < SIZE && y >= 0 && y < HEIGHT;
  }

  get(x: number, y: number, z: number): number {
    if (y < 0) return STONE; // endless magic bedrock, also culls bottom faces
    if (x < 0 || x >= SIZE || z < 0 || z >= SIZE || y >= HEIGHT) return AIR;
    return this.data[x + z * SIZE + y * SIZE * SIZE];
  }

  set(x: number, y: number, z: number, id: number): void {
    if (!this.inBounds(x, y, z)) return;
    this.data[x + z * SIZE + y * SIZE * SIZE] = id;
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
