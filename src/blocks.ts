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

export const WILDGRASS = 15;
export const VINE = 16;
export const CARROT = 17;
export const PUMPKIN = 18;

export type Bucket = 'opaque' | 'glass' | 'glow' | 'cutout';

export interface BlockDef {
  id: number;
  name: string;
  /** atlas tile index for each face group */
  tiles: { top: number; side: number; bottom: number };
  /** which material the faces render with */
  bucket: Bucket;
  /** does the player collide with it */
  solid: boolean;
  /** 'cross' renders as two crossed quads (grass tufts, hanging vines) */
  shape?: 'cross';
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
  { id: 15, name: 'Wild Grass', tiles: t(16), bucket: 'cutout', solid: false, shape: 'cross', color: 0x7ed87e },
  { id: 16, name: 'Willow Vine', tiles: t(17), bucket: 'cutout', solid: false, shape: 'cross', color: 0x8fdc8a },
  { id: 17, name: 'Carrot', tiles: t(18), bucket: 'cutout', solid: false, shape: 'cross', color: 0xe8862a },
  { id: 18, name: 'Pumpkin', tiles: t(19), bucket: 'opaque', solid: true, color: 0xe8862a },
  { id: 19, name: 'Bush', tiles: t(20), bucket: 'opaque', solid: true, color: 0x5f9e54 },
  { id: 20, name: 'Snow', tiles: t(21), bucket: 'opaque', solid: true, color: 0xf4f8ff },
  { id: 21, name: 'Ice', tiles: t(22), bucket: 'glass', solid: true, color: 0xbfe6f7 },
  { id: 22, name: 'Glass', tiles: t(23), bucket: 'glass', solid: true, color: 0xe8f6fc },
  { id: 23, name: 'Marble', tiles: t(24), bucket: 'opaque', solid: true, hard: true, color: 0xf0f0f4 },
  { id: 24, name: 'Night Stone', tiles: t(25), bucket: 'opaque', solid: true, hard: true, color: 0x3a3a4e },
  { id: 25, name: 'Sun Stone', tiles: t(26), bucket: 'glow', solid: true, color: 0xffd24a },
  { id: 26, name: 'Rainbow', tiles: t(27), bucket: 'opaque', solid: true, color: 0xe06aa8 },
  { id: 27, name: 'Cozy Mint', tiles: t(28), bucket: 'opaque', solid: true, color: 0xb8ecd4 },
  { id: 28, name: 'Cozy Sky', tiles: t(29), bucket: 'opaque', solid: true, color: 0xbcd9f7 },
  { id: 29, name: 'Cozy Rose', tiles: t(30), bucket: 'opaque', solid: true, color: 0xf7c6d9 },
  // not placeable — found in the world, breaks open into treasure
  { id: 30, name: 'Treasure Chest', tiles: { top: 32, side: 31, bottom: 32 }, bucket: 'opaque', solid: true, color: 0xc09368 },
  // furniture — sleep in beds at night!
  { id: 31, name: 'Bed', tiles: { top: 33, side: 34, bottom: 14 }, bucket: 'opaque', solid: true, color: 0xe06a8a },
  { id: 32, name: 'Painting', tiles: { top: 14, side: 35, bottom: 14 }, bucket: 'opaque', solid: true, color: 0xd9a520 },
  { id: 33, name: 'Chair', tiles: { top: 14, side: 36, bottom: 14 }, bucket: 'opaque', solid: true, color: 0xb8895e },
  { id: 34, name: 'Feast Table', tiles: { top: 37, side: 14, bottom: 14 }, bucket: 'opaque', solid: true, color: 0xe0a85f },
  { id: 35, name: 'Toilet', tiles: t(38), bucket: 'opaque', solid: true, color: 0xf4f6fa },
  { id: 36, name: 'Sink', tiles: t(39), bucket: 'opaque', solid: true, color: 0xf4f6fa },
  { id: 37, name: 'Shower', tiles: t(40), bucket: 'opaque', solid: true, color: 0xbfe6f7 },
  { id: 38, name: 'Spider Web', tiles: t(41), bucket: 'cutout', solid: false, shape: 'cross', color: 0xe8e8f0 },
];

export const BUSH = 19;
export const SNOW = 20;
export const CHEST = 30;
export const BED = 31;
export const PAINTING = 32;
export const CHAIR = 33;
export const FEAST = 34;
export const TOILET = 35;
export const SINK = 36;
export const SHOWER = 37;

/** Block ids available in the hotbar, in display order. */
export const PLACEABLE = [
  1, 2, 3, 4, 6, 7, 8, 9, 10, 5,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29,
  31, 32, 33, 34, 35, 36, 37, 38,
];

export const isSolid = (id: number): boolean => BLOCKS[id]?.solid ?? false;
/** What the crosshair can aim at: solid blocks plus grass/vines (not water). */
export const isTargetable = (id: number): boolean =>
  (BLOCKS[id]?.solid ?? false) || BLOCKS[id]?.shape === 'cross';
export const isOpaque = (id: number): boolean => id !== AIR && BLOCKS[id].bucket === 'opaque';

/** Should a face of block `a` be drawn against neighbor `b`? */
export const faceVisible = (a: number, b: number): boolean =>
  b === AIR || (!isOpaque(b) && b !== a);
