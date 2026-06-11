import * as THREE from 'three';

export const TILE = 16;
export const TILE_COUNT = 41;

// Atlas tile layout:
// 0 meadow-top  1 meadow-side  2 earth  3 pebble  4 sand  5 water
// 6 timber-side 7 timber-top   8 leaf   9 crystal 10 lantern 11 blossom
// 12 castle brick  13 roof slate  14 plank  15 bookshelf
// 16 grass tuft (transparent)  17 willow strands (transparent)
// 18 carrot (transparent)  19 pumpkin  20 bush  21 snow  22 ice  23 glass
// 24 marble  25 night stone  26 sun stone  27 rainbow  28-30 cozy wools
// 31 chest front/side  32 chest top
// 33 bed top  34 bed side  35 painting  36 chair  37 feast top
// 38 toilet  39 sink  40 shower

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

  // 16: grass tuft — thin blades on a transparent background
  for (let b = 0; b < 7; b++) {
    const x = 1 + rnd(14);
    const height = 5 + rnd(8);
    const color = ['#5fae5f', '#7ed87e', '#98e898'][rnd(3)];
    for (let y = 0; y < height; y++) {
      const lean = y > height - 3 ? (b % 2 === 0 ? 1 : -1) : 0;
      px(16, Math.max(0, Math.min(15, x + lean)), 15 - y, color);
    }
  }

  // 17: willow strands — hanging vines with little leaves, transparent bg
  for (const x of [2, 6, 10, 14]) {
    const len = 12 + rnd(4);
    for (let y = 0; y < len; y++) px(17, x, y, '#6fbf6e');
    for (let y = 2; y < len; y += 3) {
      px(17, Math.max(0, x - 1), y, '#8fdc8a');
      px(17, Math.min(15, x + 1), y + 1, '#8fdc8a');
    }
  }

  // 18: carrot — orange root poking out under feathery green tops
  for (const cx of [4, 8, 12]) {
    ctx.fillStyle = '#e8862a';
    ctx.fillRect(TILE * 18 + cx - 1, 12, 2, 4);
    px(18, cx - 1, 11, '#f29c44');
    for (let y = 4; y < 12; y++) {
      px(18, cx - 1 + (y % 2), y, '#4f9e4f');
      if (y < 8) px(18, cx - 2 + (y % 3), y, '#6ec46e');
    }
  }

  // 19: pumpkin — ribbed orange
  fill(19, '#e8862a');
  ctx.fillStyle = '#c96f1e';
  for (let x = 1; x < TILE; x += 3) ctx.fillRect(TILE * 19 + x, 0, 1, TILE);
  speckle(19, ['#f29c44', '#d97a24'], 20);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(TILE * 19 + 7, 0, 2, 2); // stem nub

  // 20: bush — dense dark leaves
  fill(20, '#5f9e54');
  speckle(20, ['#4f8a45', '#73b566', '#456f3d', '#86c878'], 60);

  // 21: snow — soft white sparkle
  fill(21, '#f4f8ff');
  speckle(21, ['#ffffff', '#e2ecfa', '#d4e4f7'], 35);

  // 22: ice — pale blue with cracks
  fill(22, '#bfe6f7');
  ctx.strokeStyle = '#e4f5fd';
  ctx.beginPath();
  ctx.moveTo(TILE * 22 + 2, 13); ctx.lineTo(TILE * 22 + 7, 7); ctx.lineTo(TILE * 22 + 6, 2);
  ctx.moveTo(TILE * 22 + 9, 14); ctx.lineTo(TILE * 22 + 12, 8);
  ctx.stroke();
  speckle(22, ['#d4effa'], 12);

  // 23: glass — almost clear with a bright frame
  fill(23, '#e8f6fc');
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(TILE * 23 + 0.5, 0.5, TILE - 1, TILE - 1);
  px(23, 3, 3, '#ffffff');
  px(23, 4, 4, '#ffffff');

  // 24: marble — white with soft gray veins
  fill(24, '#f0f0f4');
  ctx.strokeStyle = '#c9c9d4';
  ctx.beginPath();
  ctx.moveTo(TILE * 24, 4); ctx.lineTo(TILE * 24 + 6, 7); ctx.lineTo(TILE * 24 + 16, 5);
  ctx.moveTo(TILE * 24, 12); ctx.lineTo(TILE * 24 + 9, 13); ctx.lineTo(TILE * 24 + 16, 10);
  ctx.stroke();
  speckle(24, ['#e2e2ea'], 10);

  // 25: night stone — deep twilight with tiny stars
  fill(25, '#3a3a4e');
  speckle(25, ['#2e2e40', '#46465c'], 30);
  speckle(25, ['#cfcfff', '#ffffff'], 5);

  // 26: sun stone — molten gold (renders unlit, so it glows)
  for (let x = 0; x < TILE; x++) {
    for (let y = 0; y < TILE; y++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      px(26, x, y, d < 4 ? '#ffe98f' : d < 6.5 ? '#ffd24a' : '#f0b730');
    }
  }
  speckle(26, ['#ffffff'], 4);

  // 27: rainbow — every kid's favorite
  const rainbow = ['#e06a6a', '#f0a04a', '#f7d44a', '#6ec46e', '#5fa8e0', '#a87ad6'];
  for (let y = 0; y < TILE; y++) {
    ctx.fillStyle = rainbow[Math.floor((y / TILE) * rainbow.length)];
    ctx.fillRect(TILE * 27, y, TILE, 1);
  }
  speckle(27, ['#ffffff'], 6);

  // 28-30: cozy wool blocks
  fill(28, '#b8ecd4');
  speckle(28, ['#a6e2c6', '#cdf4e2'], 30);
  fill(29, '#bcd9f7');
  speckle(29, ['#aacdf2', '#cfe5fa'], 30);
  fill(30, '#f7c6d9');
  speckle(30, ['#f2b4cd', '#fbd8e6'], 30);

  // 31: treasure chest side — banded wood with a golden latch
  fill(31, '#a87c52');
  ctx.fillStyle = '#8a6240';
  ctx.fillRect(TILE * 31, 0, TILE, 1);
  ctx.fillRect(TILE * 31, 5, TILE, 2); // lid seam
  ctx.fillRect(TILE * 31, 15, TILE, 1);
  ctx.fillStyle = '#c89c70';
  ctx.fillRect(TILE * 31, 2, TILE, 1);
  ctx.fillRect(TILE * 31, 9, TILE, 1);
  ctx.fillRect(TILE * 31, 12, TILE, 1);
  ctx.fillStyle = '#ffd24a'; // latch
  ctx.fillRect(TILE * 31 + 6, 4, 4, 5);
  ctx.fillStyle = '#b8860b';
  ctx.fillRect(TILE * 31 + 7, 6, 2, 2);

  // 32: chest top — banded wood
  fill(32, '#b8895e');
  ctx.fillStyle = '#8a6240';
  for (const y of [0, 7, 8, 15]) ctx.fillRect(TILE * 32, y, TILE, 1);
  speckle(32, ['#a87c52', '#c89c70'], 14);

  // 33: bed top — rose blanket with a white pillow band
  fill(33, '#e06a8a');
  ctx.fillStyle = '#f2f2fa';
  ctx.fillRect(TILE * 33, 0, TILE, 5); // pillow
  ctx.fillStyle = '#c95572';
  for (let y = 7; y < TILE; y += 3) ctx.fillRect(TILE * 33, y, TILE, 1);
  speckle(33, ['#ea8aa2'], 8);

  // 34: bed side — wooden frame with blanket stripe
  fill(34, '#a87c52');
  ctx.fillStyle = '#e06a8a';
  ctx.fillRect(TILE * 34, 0, TILE, 6);
  ctx.fillStyle = '#f2f2fa';
  ctx.fillRect(TILE * 34, 0, 4, 6);

  // 35: painting — gilt frame around a tiny landscape
  fill(35, '#d9a520');
  ctx.fillStyle = '#8ed0ff';
  ctx.fillRect(TILE * 35 + 2, 2, 12, 12);
  ctx.fillStyle = '#4a9e5f';
  ctx.fillRect(TILE * 35 + 2, 9, 12, 5);
  ctx.fillStyle = '#ffd24a';
  ctx.fillRect(TILE * 35 + 10, 4, 3, 3); // little sun
  ctx.fillStyle = '#b8860b';
  ctx.strokeStyle = '#b8860b';
  ctx.strokeRect(TILE * 35 + 1.5, 1.5, 13, 13);

  // 36: chair — wooden seat with slat back
  fill(36, '#b8895e');
  ctx.fillStyle = '#8a6240';
  for (const x of [2, 6, 10, 14]) ctx.fillRect(TILE * 36 + x, 1, 2, 9);
  ctx.fillStyle = '#d9b487';
  ctx.fillRect(TILE * 36, 10, TILE, 3); // seat

  // 37: feast top — a tablecloth covered in food
  fill(37, '#f2ecff');
  ctx.fillStyle = '#e0a85f';
  ctx.fillRect(TILE * 37 + 2, 3, 4, 3); // bread
  ctx.fillStyle = '#e8862a';
  ctx.fillRect(TILE * 37 + 10, 2, 4, 4); // pumpkin pie
  ctx.fillStyle = '#7be0a0';
  ctx.fillRect(TILE * 37 + 3, 10, 3, 3); // greens
  ctx.fillStyle = '#e06a6a';
  ctx.fillRect(TILE * 37 + 9, 10, 3, 3); // berries
  ctx.fillStyle = '#ffd24a';
  ctx.fillRect(TILE * 37 + 7, 6, 2, 2); // butter!

  // 38: toilet — porcelain with a seat ring
  fill(38, '#f4f6fa');
  ctx.fillStyle = '#c9cedd';
  ctx.strokeStyle = '#c9cedd';
  ctx.beginPath();
  ctx.arc(TILE * 38 + 8, 8, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#dde3f0';
  ctx.fillRect(TILE * 38, 13, TILE, 3); // base

  // 39: sink — porcelain with a faucet
  fill(39, '#f4f6fa');
  ctx.fillStyle = '#9aa3b8';
  ctx.fillRect(TILE * 39 + 7, 2, 2, 4); // faucet
  ctx.fillRect(TILE * 39 + 5, 2, 6, 2);
  ctx.fillStyle = '#bfe6f7';
  ctx.fillRect(TILE * 39 + 5, 8, 6, 4); // basin water
  ctx.fillStyle = '#dde3f0';
  ctx.strokeStyle = '#c9cedd';
  ctx.strokeRect(TILE * 39 + 3.5, 6.5, 9, 7);

  // 40: shower — blue tiles with a shower head and spray
  fill(40, '#bfe6f7');
  ctx.fillStyle = '#a5d4ec';
  for (let x = 0; x < TILE; x += 4) ctx.fillRect(TILE * 40 + x, 0, 1, TILE);
  for (let y = 0; y < TILE; y += 4) ctx.fillRect(TILE * 40, y, TILE, 1);
  ctx.fillStyle = '#9aa3b8';
  ctx.fillRect(TILE * 40 + 5, 1, 6, 2); // head
  ctx.fillStyle = '#e4f5fd';
  for (const [dx, dy] of [[5, 4], [8, 5], [11, 4], [6, 8], [10, 9], [8, 12]] as const) {
    ctx.fillRect(TILE * 40 + dx, dy, 1, 2); // droplets
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
