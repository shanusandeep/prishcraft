import * as THREE from 'three';
import { AIR, BLOCKS, faceVisible, Bucket } from './blocks';
import { World, HEIGHT } from './world';
import { Atlas } from './textures';

const CHUNK = 16;

interface Face {
  dir: [number, number, number];
  corners: Array<{ pos: [number, number, number]; uv: [number, number] }>;
  shade: number;
  pick: 'top' | 'bottom' | 'side';
}

// Counter-clockwise quads, two triangles each (a, a+1, a+2, a+2, a+1, a+3)
const FACES: Face[] = [
  { dir: [-1, 0, 0], shade: 0.78, pick: 'side', corners: [
    { pos: [0, 1, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [0, 0] },
    { pos: [0, 1, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [1, 0] } ] },
  { dir: [1, 0, 0], shade: 0.78, pick: 'side', corners: [
    { pos: [1, 1, 1], uv: [0, 1] }, { pos: [1, 0, 1], uv: [0, 0] },
    { pos: [1, 1, 0], uv: [1, 1] }, { pos: [1, 0, 0], uv: [1, 0] } ] },
  { dir: [0, -1, 0], shade: 0.55, pick: 'bottom', corners: [
    { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 0, 1], uv: [0, 0] },
    { pos: [1, 0, 0], uv: [1, 1] }, { pos: [0, 0, 0], uv: [0, 1] } ] },
  { dir: [0, 1, 0], shade: 1.0, pick: 'top', corners: [
    { pos: [0, 1, 1], uv: [1, 1] }, { pos: [1, 1, 1], uv: [0, 1] },
    { pos: [0, 1, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 0] } ] },
  { dir: [0, 0, -1], shade: 0.68, pick: 'side', corners: [
    { pos: [1, 0, 0], uv: [0, 0] }, { pos: [0, 0, 0], uv: [1, 0] },
    { pos: [1, 1, 0], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 1] } ] },
  { dir: [0, 0, 1], shade: 0.68, pick: 'side', corners: [
    { pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 1], uv: [1, 0] },
    { pos: [0, 1, 1], uv: [0, 1] }, { pos: [1, 1, 1], uv: [1, 1] } ] },
];

const BUCKETS: Bucket[] = ['opaque', 'glass', 'glow', 'cutout'];

// two crossed quads for grass tufts and vines, same vertex order as FACES
const CROSS_PLANES: Array<Array<{ pos: [number, number, number]; uv: [number, number] }>> = [
  [
    { pos: [0, 1, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [0, 0] },
    { pos: [1, 1, 1], uv: [1, 1] }, { pos: [1, 0, 1], uv: [1, 0] },
  ],
  [
    { pos: [1, 1, 0], uv: [0, 1] }, { pos: [1, 0, 0], uv: [0, 0] },
    { pos: [0, 1, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [1, 0] },
  ],
];

/**
 * Rebuilds chunk meshes from the voxel data. Only faces touching air or
 * see-through blocks are emitted, bucketed into three materials:
 * opaque (lit), glass (translucent), glow (unlit, so it looks bright).
 */
export class VoxelRenderer {
  private materials: Record<Bucket, THREE.Material>;
  private meshes = new Map<string, THREE.Mesh[]>();

  constructor(private world: World, private scene: THREE.Scene, private atlas: Atlas) {
    const map = atlas.texture;
    this.materials = {
      opaque: new THREE.MeshLambertMaterial({ map, vertexColors: true }),
      glass: new THREE.MeshLambertMaterial({ map, vertexColors: true, transparent: true, opacity: 0.72 }),
      glow: new THREE.MeshBasicMaterial({ map }),
      cutout: new THREE.MeshLambertMaterial({ map, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    };
  }

  /** How far (in chunks) the world is built around the player. */
  viewRadius = 8;

  private lastCx = NaN;
  private lastCz = NaN;
  private queue: Array<[number, number]> = [];
  private queued = new Set<string>();

  private chunksX(): number {
    return Math.ceil(this.world.sizeX / CHUNK);
  }

  private chunksZ(): number {
    return Math.ceil(this.world.sizeZ / CHUNK);
  }

  /** Swap to a different world (realm), even one of a different size. */
  setWorld(world: World, px: number, pz: number): void {
    for (const meshes of this.meshes.values()) {
      for (const mesh of meshes) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
      }
    }
    this.meshes.clear();
    this.queue.length = 0;
    this.queued.clear();
    this.lastCx = NaN;
    this.lastCz = NaN;
    this.world = world;
    this.update(px, pz, 81); // build the whole nearby area right away
  }

  /**
   * Streams chunks around the player: big worlds are never fully meshed,
   * just the part you can see. Call every frame; `budget` chunks are built
   * per call (nearest first), and far-away chunks are dropped.
   */
  update(px: number, pz: number, budget = 3): void {
    const ccx = Math.floor(px / CHUNK), ccz = Math.floor(pz / CHUNK);
    const R = this.viewRadius;

    if (ccx !== this.lastCx || ccz !== this.lastCz) {
      this.lastCx = ccx;
      this.lastCz = ccz;

      const wanted: Array<[number, number, number]> = [];
      for (let cx = Math.max(0, ccx - R); cx <= Math.min(this.chunksX() - 1, ccx + R); cx++) {
        for (let cz = Math.max(0, ccz - R); cz <= Math.min(this.chunksZ() - 1, ccz + R); cz++) {
          const key = `${cx},${cz}`;
          if (this.meshes.has(key) || this.queued.has(key)) continue;
          wanted.push([cx, cz, Math.max(Math.abs(cx - ccx), Math.abs(cz - ccz))]);
        }
      }
      wanted.sort((a, b) => a[2] - b[2]);
      for (const [cx, cz] of wanted) {
        this.queue.push([cx, cz]);
        this.queued.add(`${cx},${cz}`);
      }

      // forget chunks far behind us
      for (const [key, meshes] of this.meshes) {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.max(Math.abs(cx - ccx), Math.abs(cz - ccz)) > R + 2) {
          for (const mesh of meshes) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
          }
          this.meshes.delete(key);
        }
      }
    }

    for (let i = 0; i < budget && this.queue.length > 0; ) {
      const [cx, cz] = this.queue.shift()!;
      this.queued.delete(`${cx},${cz}`);
      if (Math.max(Math.abs(cx - this.lastCx), Math.abs(cz - this.lastCz)) > R) continue; // drifted away
      this.buildChunk(cx, cz);
      i++;
    }
  }

  /** Rebuild the chunk containing an edited block, plus built neighbors on a border. */
  blockChanged(x: number, z: number): void {
    const dirty = new Set<string>();
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    dirty.add(`${cx},${cz}`);
    if (x % CHUNK === 0 && cx > 0) dirty.add(`${cx - 1},${cz}`);
    if (x % CHUNK === CHUNK - 1 && cx < this.chunksX() - 1) dirty.add(`${cx + 1},${cz}`);
    if (z % CHUNK === 0 && cz > 0) dirty.add(`${cx},${cz - 1}`);
    if (z % CHUNK === CHUNK - 1 && cz < this.chunksZ() - 1) dirty.add(`${cx},${cz + 1}`);
    for (const key of dirty) {
      if (!this.meshes.has(key)) continue; // not built; it'll mesh correctly when streamed in
      const [a, b] = key.split(',').map(Number);
      this.buildChunk(a, b);
    }
  }

  private buildChunk(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    for (const old of this.meshes.get(key) ?? []) {
      this.scene.remove(old);
      old.geometry.dispose();
    }

    type Buf = { pos: number[]; norm: number[]; uv: number[]; col: number[]; idx: number[] };
    const bufs: Record<Bucket, Buf> = {
      opaque: { pos: [], norm: [], uv: [], col: [], idx: [] },
      glass: { pos: [], norm: [], uv: [], col: [], idx: [] },
      glow: { pos: [], norm: [], uv: [], col: [], idx: [] },
      cutout: { pos: [], norm: [], uv: [], col: [], idx: [] },
    };

    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    const x1 = Math.min(x0 + CHUNK, this.world.sizeX);
    const z1 = Math.min(z0 + CHUNK, this.world.sizeZ);
    for (let x = x0; x < x1; x++) {
      for (let z = z0; z < z1; z++) {
        for (let y = 0; y < HEIGHT; y++) {
          const id = this.world.get(x, y, z);
          if (id === AIR) continue;
          const def = BLOCKS[id];
          const buf = bufs[def.bucket];

          if (def.shape === 'cross') {
            const { u0, v0, u1, v1 } = this.atlas.uv(def.tiles.side);
            for (const plane of CROSS_PLANES) {
              const base = buf.pos.length / 3;
              for (const corner of plane) {
                buf.pos.push(x + corner.pos[0], y + corner.pos[1], z + corner.pos[2]);
                buf.norm.push(0, 1, 0);
                buf.uv.push(u0 + (u1 - u0) * corner.uv[0], v0 + (v1 - v0) * corner.uv[1]);
                buf.col.push(1, 1, 1);
              }
              buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
            }
            continue;
          }

          const height = def.height ?? 1;
          const yOff = def.anchor === 'top' ? 1 - height : 0; // ceiling fans hang down
          for (const face of FACES) {
            const neighbor = this.world.get(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
            // low furniture (beds, chairs) always shows its top and sides
            if (!faceVisible(id, neighbor) && !(height < 1 && face.dir[1] >= 0)) continue;

            const tile = def.tiles[face.pick];
            const { u0, v0, u1, v1 } = this.atlas.uv(tile);
            const base = buf.pos.length / 3;
            for (const corner of face.corners) {
              buf.pos.push(x + corner.pos[0], y + yOff + corner.pos[1] * height, z + corner.pos[2]);
              buf.norm.push(...face.dir);
              buf.uv.push(u0 + (u1 - u0) * corner.uv[0], v0 + (v1 - v0) * corner.uv[1]);
              buf.col.push(face.shade, face.shade, face.shade);
            }
            buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }
      }
    }

    const created: THREE.Mesh[] = [];
    for (const bucket of BUCKETS) {
      const buf = bufs[bucket];
      if (buf.idx.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
      geo.setIndex(buf.idx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, this.materials[bucket]);
      this.scene.add(mesh);
      created.push(mesh);
    }
    this.meshes.set(key, created);
  }
}
