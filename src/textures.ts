import * as THREE from 'three';

export const TILE = 16;
export const TILE_COUNT = 16;

// Atlas tile layout:
// 0 meadow-top  1 meadow-side  2 earth  3 pebble  4 sand  5 water
// 6 timber-side 7 timber-top   8 leaf   9 crystal 10 lantern 11 blossom
// 12 castle brick  13 roof slate  14 plank  15 bookshelf

export interface Atlas {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  /** uv rect of a tile, inset half a texel to avoid bleeding */
  uv(tile: number): { u0: number; v0: number; u1: number; v1: number };
  /** small pixelated icon of a tile as a data URL (for the hotbar) */
  icon(tile: number, size: number): string;
}

export function createAtlas(): Atlas {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * TILE_COUNT;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d')!;

  const rnd = (n: number) => Math.floor(Math.random() * n);
  const fill = (tile: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(tile * TILE, 0, TILE, TILE);
  };
  const px = (tile: number, x: number, y: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(tile * TILE + x, y, 1, 1);
  };
  const speckle = (tile: number, colors: string[], n: number) => {
    for (let i = 0; i < n; i++) px(tile, rnd(TILE), rnd(TILE), colors[rnd(colors.length)]);
  };

  // 0: meadow top — soft green with light/dark grass and tiny flowers
  fill(0, '#82d97f');
  speckle(0, ['#9ae896', '#6cc46c', '#8fe28b'], 50);
  speckle(0, ['#fff6fb', '#ffd9ec'], 4);

  // 1: meadow side — earth with a grassy fringe
  fill(1, '#b98a64');
  speckle(1, ['#a87a55', '#c79a74'], 30);
  ctx.fillStyle = '#82d97f';
  ctx.fillRect(TILE * 1, 0, TILE, 4);
  for (let x = 0; x < TILE; x++) if (Math.random() < 0.55) px(1, x, 4, '#76cc74');

  // 2: earth
  fill(2, '#b98a64');
  speckle(2, ['#a87a55', '#c79a74', '#9c7050'], 45);

  // 3: pebble stone
  fill(3, '#b9bcc9');
  speckle(3, ['#a8abba', '#c9ccd9', '#9da0b0'], 45);

  // 4: sun sand
  fill(4, '#f6e3a8');
  speckle(4, ['#efd896', '#fdeebc', '#e8d28f'], 40);

  // 5: sea sparkle — blue with light wave streaks
  fill(5, '#7fd4f0');
  for (let i = 0; i < 6; i++) {
    const y = rnd(TILE);
    const x = rnd(10);
    ctx.fillStyle = i % 2 ? '#a5e4f7' : '#92dcf4';
    ctx.fillRect(TILE * 5 + x, y, 3 + rnd(4), 1);
  }
  speckle(5, ['#ffffff'], 3);

  // 6: timber side — vertical grain
  for (let x = 0; x < TILE; x++) {
    const shade = x % 4 === 0 ? '#a87c52' : x % 4 === 2 ? '#c89c70' : '#c09368';
    ctx.fillStyle = shade;
    ctx.fillRect(TILE * 6 + x, 0, 1, TILE);
  }
  speckle(6, ['#96703f'], 8);

  // 7: timber top — rings
  fill(7, '#d2a878');
  ctx.strokeStyle = '#b98a5a';
  for (let r = 2; r < 8; r += 2) {
    ctx.strokeRect(TILE * 7 + 8 - r + 0.5, 8 - r + 0.5, r * 2 - 1, r * 2 - 1);
  }

  // 8: leafy puff — green with flowers
  fill(8, '#8fdc8a');
  speckle(8, ['#6fbf6e', '#aef0a8', '#7ecf7b'], 45);
  speckle(8, ['#ffd9ec', '#fff6fb'], 4);

  // 9: dream crystal — pink with diagonal facets
  for (let x = 0; x < TILE; x++) {
    for (let y = 0; y < TILE; y++) {
      const d = (x + y) % 6;
      px(9, x, y, d < 2 ? '#ffd9fb' : d < 4 ? '#f3b6ec' : '#dd95d8');
    }
  }
  speckle(9, ['#ffffff'], 5);

  // 10: star lantern — warm glow from the center
  for (let x = 0; x < TILE; x++) {
    for (let y = 0; y < TILE; y++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      px(10, x, y, d < 3.5 ? '#fff6c9' : d < 6 ? '#ffe78f' : '#ffd966');
    }
  }
  px(10, 7, 7, '#ffffff');
  px(10, 8, 8, '#ffffff');

  // 11: blossom — soft pink
  fill(11, '#f8c8dc');
  speckle(11, ['#ffe0ec', '#eaaecb', '#fbd3e3'], 40);
  speckle(11, ['#ffffff'], 4);

  // 12: castle brick — gray-blue bricks with mortar lines
  fill(12, '#9aa3b8');
  ctx.fillStyle = '#c9cedd';
  for (let row = 0; row < 4; row++) {
    const y = row * 4 + 3;
    ctx.fillRect(TILE * 12, y, TILE, 1);
    const offset = row % 2 === 0 ? 3 : 7;
    for (let x = offset; x < TILE; x += 8) ctx.fillRect(TILE * 12 + x, row * 4, 1, 3);
  }
  speckle(12, ['#8a92a8', '#a8b0c4'], 16);

  // 13: roof slate — purple shingles
  fill(13, '#8d8ad6');
  ctx.fillStyle = '#6f6cc4';
  for (let y = 3; y < TILE; y += 4) ctx.fillRect(TILE * 13, y, TILE, 1);
  speckle(13, ['#9d9ae2', '#7b78cc'], 18);

  // 14: plank — warm boards
  fill(14, '#d9b487');
  ctx.fillStyle = '#b8945f';
  for (let y = 3; y < TILE; y += 4) ctx.fillRect(TILE * 14, y, TILE, 1);
  speckle(14, ['#cba771', '#e3c096'], 16);

  // 15: bookshelf — plank frame with rows of colorful book spines
  fill(15, '#c89c70');
  const spineColors = ['#e06a6a', '#5fa8e0', '#6ec46e', '#e0a85f', '#a87ad6', '#e08ab8'];
  for (const rowY of [2, 9]) {
    for (let x = 1; x < TILE - 1; x += 2) {
      ctx.fillStyle = spineColors[rnd(spineColors.length)];
      ctx.fillRect(TILE * 15 + x, rowY, 2, 5);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  const W = TILE * TILE_COUNT;
  return {
    canvas,
    texture,
    uv(tile: number) {
      return {
        u0: (tile * TILE + 0.5) / W,
        u1: ((tile + 1) * TILE - 0.5) / W,
        v0: 0.5 / TILE,
        v1: (TILE - 0.5) / TILE,
      };
    },
    icon(tile: number, size: number) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ictx = c.getContext('2d')!;
      ictx.imageSmoothingEnabled = false;
      ictx.drawImage(canvas, tile * TILE, 0, TILE, TILE, 0, 0, size, size);
      return c.toDataURL();
    },
  };
}
