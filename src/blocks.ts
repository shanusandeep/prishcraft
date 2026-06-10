export const AIR = 0;
export const WATER = 5;
export const TIMBER = 6;
export const LEAF = 7;
export const CRYSTAL = 8;
export const LANTERN = 9;
export const BLOSSOM = 10;
export const BRICK = 11;
export const ROOF = 12;
export const PLANK = 13;
export const BOOKSHELF = 14;

export type Bucket = 'opaque' | 'glass' | 'glow';

export interface BlockDef {
  id: number;
  name: string;
  /** atlas tile index for each face group */
  tiles: { top: number; side: number; bottom: number };
  /** which material the faces render with */
  bucket: Bucket;
  /** does the player collide with it */
  solid: boolean;
  /** too hard for bare hands — needs the wand to break */
  hard?: boolean;
  /** representative color for particles and UI fallbacks */
  color: number;
}

const t = (top: number, side = top, bottom = side) => ({ top, side, bottom });

export const BLOCKS: BlockDef[] = [
  { id: 0, name: 'Air', tiles: t(0), bucket: 'opaque', solid: false, color: 0 },
  { id: 1, name: 'Meadow', tiles: { top: 0, side: 1, bottom: 2 }, bucket: 'opaque', solid: true, color: 0x82d97f },
  { id: 2, name: 'Earth', tiles: t(2), bucket: 'opaque', solid: true, color: 0xb98a64 },
  { id: 3, name: 'Pebble', tiles: t(3), bucket: 'opaque', solid: true, hard: true, color: 0xb9bcc9 },
  { id: 4, name: 'Sun Sand', tiles: t(4), bucket: 'opaque', solid: true, color: 0xf6e3a8 },
  { id: 5, name: 'Sea Sparkle', tiles: t(5), bucket: 'glass', solid: false, color: 0x7fd4f0 },
  { id: 6, name: 'Timber', tiles: { top: 7, side: 6, bottom: 7 }, bucket: 'opaque', solid: true, color: 0xc09368 },
  { id: 7, name: 'Leafy Puff', tiles: t(8), bucket: 'opaque', solid: true, color: 0x8fdc8a },
  { id: 8, name: 'Dream Crystal', tiles: t(9), bucket: 'glass', solid: true, color: 0xf0a6e8 },
  { id: 9, name: 'Star Lantern', tiles: t(10), bucket: 'glow', solid: true, color: 0xffe27a },
  { id: 10, name: 'Blossom', tiles: t(11), bucket: 'opaque', solid: true, color: 0xf8c8dc },
  { id: 11, name: 'Castle Brick', tiles: t(12), bucket: 'opaque', solid: true, hard: true, color: 0x9aa3b8 },
  { id: 12, name: 'Roof Slate', tiles: t(13), bucket: 'opaque', solid: true, hard: true, color: 0x8d8ad6 },
  { id: 13, name: 'Plank', tiles: t(14), bucket: 'opaque', solid: true, color: 0xd9b487 },
  { id: 14, name: 'Bookshelf', tiles: { top: 14, side: 15, bottom: 14 }, bucket: 'opaque', solid: true, color: 0xb06a5a },
];

/** Block ids available in the hotbar, in display order. */
export const PLACEABLE = [1, 2, 3, 4, 6, 7, 8, 9, 10, 5, 11, 12, 13, 14];

export const isSolid = (id: number): boolean => BLOCKS[id]?.solid ?? false;
export const isOpaque = (id: number): boolean => id !== AIR && BLOCKS[id].bucket === 'opaque';

/** Should a face of block `a` be drawn against neighbor `b`? */
export const faceVisible = (a: number, b: number): boolean =>
  b === AIR || (!isOpaque(b) && b !== a);
