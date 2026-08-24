'use strict';
// ---------------------------------------------------------------- procedural texture atlas
// 16px tiles in a 16x16 grid (256x256 canvas). Everything is drawn in code.

const ATLAS_TILES = 16, TILE = 16, ATLAS_PX = ATLAS_TILES * TILE;
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = atlasCanvas.height = ATLAS_PX;
const actx = atlasCanvas.getContext('2d', { willReadFrequently: true });
let _nextTile = 0;
const TileIdx = {}; // name -> tile index

function tileXY(i) { return [(i % ATLAS_TILES) * TILE, Math.floor(i / ATLAS_TILES) * TILE]; }

// drawing context for one tile
function T(name, fn) {
  const i = _nextTile++;
  TileIdx[name] = i;
  const [ox, oy] = tileXY(i);
  const img = actx.createImageData(TILE, TILE);
  const rng = mulberry32(0xBEEF ^ (i * 2654435761));
  const d = {
    rng,
    px(x, y, c, a = 255) {
      if (x < 0 || y < 0 || x > 15 || y > 15) return;
      const o = (y * TILE + x) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = a;
    },
    get(x, y) { const o = (y * TILE + x) * 4; return [img.data[o], img.data[o+1], img.data[o+2], img.data[o+3]]; },
    fill(c, vary = 0, a = 255) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = (rng() - 0.5) * 2 * vary;
        d.px(x, y, [c[0] + v, c[1] + v, c[2] + v], a);
      }
    },
    rect(x0, y0, w, h, c, vary = 0, a = 255) {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const v = (rng() - 0.5) * 2 * vary;
        d.px(x, y, [c[0] + v, c[1] + v, c[2] + v], a);
      }
    },
    speckle(c, n, vary = 0) {
      for (let k = 0; k < n; k++) {
        const v = (rng() - 0.5) * 2 * vary;
        d.px((rng() * 16) | 0, (rng() * 16) | 0, [c[0] + v, c[1] + v, c[2] + v]);
      }
    },
    border(c, vary = 0) {
      for (let i2 = 0; i2 < 16; i2++) {
        const v = () => (rng() - 0.5) * 2 * vary;
        d.px(i2, 0, [c[0]+v(),c[1]+v(),c[2]+v()]); d.px(i2, 15, [c[0]+v(),c[1]+v(),c[2]+v()]);
        d.px(0, i2, [c[0]+v(),c[1]+v(),c[2]+v()]); d.px(15, i2, [c[0]+v(),c[1]+v(),c[2]+v()]);
      }
    },
    // ascii pattern with color map; '.' = transparent
    pat(rows, map) {
      for (let y = 0; y < rows.length; y++)
        for (let x = 0; x < rows[y].length; x++) {
          const ch = rows[y][x];
          if (ch === '.' || ch === ' ') continue;
          const c = map[ch];
          const v = (rng() - 0.5) * 14;
          d.px(x, y, [c[0] + v, c[1] + v, c[2] + v]);
        }
    },
  };
  fn(d);
  actx.putImageData(img, ox, oy);
  return i;
}

// stone-ish base helper
function stoneBase(d, base, vary) {
  d.fill(base, vary);
  for (let k = 0; k < 8; k++) {
    const x = (d.rng() * 16) | 0, y = (d.rng() * 16) | 0, len = 2 + (d.rng() * 4) | 0;
    for (let i = 0; i < len; i++) d.px(x + i, y, [base[0] - 22, base[1] - 22, base[2] - 22]);
  }
}
function oreTile(name, base, oreC) {
  return T(name, d => {
    stoneBase(d, [127, 127, 127], 10);
    for (let k = 0; k < 5; k++) {
      const x = 2 + (d.rng() * 11) | 0, y = 2 + (d.rng() * 11) | 0;
      d.px(x, y, oreC); d.px(x + 1, y, oreC); d.px(x, y + 1, oreC);
      d.px(x + 1, y + 1, [oreC[0] * 0.75, oreC[1] * 0.75, oreC[2] * 0.75]);
    }
  });
}
function logSide(name, bark, dark) {
  return T(name, d => {
    d.fill(bark, 10);
    for (let x = 0; x < 16; x += 3 + (d.rng() * 2 | 0))
      for (let y = 0; y < 16; y++) if (d.rng() < 0.8) d.px(x, y, dark);
  });
}
function leavesTile(name, base) {
  return T(name, d => {
    d.fill([0,0,0], 0, 0);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (d.rng() < 0.86) {
        const v = (d.rng() - 0.5) * 34;
        d.px(x, y, [base[0] + v, base[1] + v, base[2] + v]);
      }
    }
  });
}

// ---------------- terrain tiles ----------------
T('grass_top', d => { d.fill([98, 160, 58], 16); d.speckle([80, 138, 44], 46, 8); });
T('dirt', d => { d.fill([134, 96, 67], 13); d.speckle([106, 74, 50], 34, 8); d.speckle([155, 118, 84], 20, 8); });
T('grass_side', d => {
  d.fill([134, 96, 67], 13); d.speckle([106, 74, 50], 26, 8);
  d.rect(0, 0, 16, 3, [98, 160, 58], 14);
  for (let x = 0; x < 16; x++) if (d.rng() < 0.6) d.px(x, 3, [98, 160, 58]);
});
T('stone', d => stoneBase(d, [127, 127, 127], 9));
T('cobblestone', d => {
  d.fill([110, 110, 110], 16);
  for (let k = 0; k < 7; k++) {
    const x = (d.rng() * 13) | 0, y = (d.rng() * 13) | 0, r = 2 + (d.rng() * 3 | 0);
    const g = 100 + d.rng() * 45;
    d.rect(x, y, r, r, [g, g, g], 8);
  }
  d.speckle([70, 70, 70], 30, 8);
});
T('bedrock', d => { d.fill([70, 70, 70], 34); d.speckle([30, 30, 30], 44, 10); });
T('sand', d => { d.fill([219, 207, 163], 8); d.speckle([196, 184, 138], 34, 6); });
T('gravel', d => { d.fill([132, 127, 123], 20); d.speckle([90, 86, 82], 30, 12); d.speckle([160, 155, 150], 22, 10); });
logSide('oak_log', [104, 82, 50], [78, 60, 34]);
T('log_top', d => {
  d.fill([104, 82, 50], 8);
  d.rect(2, 2, 12, 12, [178, 142, 88], 8);
  d.rect(4, 4, 8, 8, [150, 116, 66], 6);
  d.rect(6, 6, 4, 4, [178, 142, 88], 6);
});
leavesTile('oak_leaves', [58, 122, 40]);
T('oak_planks', d => {
  d.fill([160, 129, 79], 8);
  for (const y of [0, 4, 8, 12]) d.rect(0, y, 16, 1, [116, 90, 52], 4);
  d.px(4, 2, [116,90,52]); d.px(12, 6, [116,90,52]); d.px(3, 10, [116,90,52]); d.px(11, 14, [116,90,52]);
});
T('water', d => { d.fill([52, 92, 200], 12, 200); d.speckle([80, 120, 220], 26, 10); });
T('glass', d => {
  d.fill([0,0,0], 0, 0);
  d.border([210, 230, 235]);
  d.px(3, 2, [255,255,255],190); d.px(4, 3, [255,255,255],190); d.px(2, 3, [255,255,255],150);
  d.px(12, 11, [255,255,255],120); d.px(11, 12, [255,255,255],120);
});
oreTile('coal_ore', null, [40, 40, 40]);
oreTile('iron_ore', null, [216, 175, 147]);
oreTile('gold_ore', null, [252, 222, 80]);
oreTile('diamond_ore', null, [90, 230, 220]);
T('table_top', d => {
  d.fill([160, 129, 79], 8); d.border([116, 90, 52]);
  d.rect(2, 2, 5, 5, [190, 160, 110], 6); d.rect(9, 9, 5, 5, [190, 160, 110], 6);
  d.rect(9, 2, 5, 5, [140, 110, 66], 6); d.rect(2, 9, 5, 5, [140, 110, 66], 6);
});
T('table_side', d => {
  d.fill([160, 129, 79], 8);
  d.rect(0, 0, 16, 2, [116, 90, 52], 4);
  d.rect(2, 4, 4, 5, [90, 68, 40], 5); d.rect(10, 4, 4, 5, [90, 68, 40], 5); // tools
  d.rect(0, 12, 16, 1, [116, 90, 52], 4);
});
T('furnace_side', d => { stoneBase(d, [120,120,120], 8); d.border([90,90,90], 6); });
T('furnace_front', d => {
  stoneBase(d, [120,120,120], 8); d.border([90,90,90], 6);
  d.rect(4, 8, 8, 6, [40, 40, 40], 6);
});
T('furnace_front_lit', d => {
  stoneBase(d, [120,120,120], 8); d.border([90,90,90], 6);
  d.rect(4, 8, 8, 6, [40, 40, 40], 6);
  d.rect(5, 10, 6, 4, [255, 140, 20], 30);
  d.px(6, 9, [255, 220, 80]); d.px(9, 9, [255, 220, 80]);
});
T('torch', d => {
  d.fill([0,0,0], 0, 0);
  d.rect(7, 6, 2, 10, [150, 118, 70], 8);
  d.rect(7, 4, 2, 2, [255, 200, 60], 10);
  d.px(7, 3, [255, 240, 160]); d.px(8, 3, [255, 240, 160]);
});
T('snowy_grass_side', d => {
  d.fill([134, 96, 67], 13); d.speckle([106, 74, 50], 26, 8);
  d.rect(0, 0, 16, 3, [240, 246, 250], 6);
});
T('snow', d => { d.fill([240, 246, 250], 5); d.speckle([220, 228, 238], 22, 4); });
T('cactus_side', d => {
  d.fill([14, 100, 32], 8);
  for (const x of [1, 5, 9, 13]) d.rect(x, 0, 1, 16, [60, 150, 70], 8);
  d.speckle([8, 70, 22], 12, 4);
});
T('cactus_top', d => { d.fill([14, 100, 32], 8); d.border([60, 150, 70], 6); });
T('sandstone_side', d => {
  d.fill([215, 203, 158], 6);
  d.rect(0, 0, 16, 2, [225, 213, 170], 4); d.rect(0, 13, 16, 3, [200, 188, 142], 5);
  d.speckle([190, 178, 132], 18, 6);
});
logSide('birch_log', [216, 215, 210], [60, 60, 56]);
logSide('spruce_log', [58, 38, 20], [40, 26, 12]);
leavesTile('spruce_leaves', [46, 90, 52]);
T('dandelion', d => {
  d.fill([0,0,0], 0, 0);
  d.rect(7, 8, 1, 8, [46, 110, 30], 6);
  d.px(6, 10, [46,110,30]); d.px(9, 11, [46,110,30]);
  d.rect(6, 4, 3, 3, [255, 216, 30], 10); d.px(7, 3, [255, 236, 120]);
});
T('poppy', d => {
  d.fill([0,0,0], 0, 0);
  d.rect(7, 8, 1, 8, [46, 110, 30], 6);
  d.px(6, 11, [46,110,30]); d.px(9, 10, [46,110,30]);
  d.rect(6, 3, 3, 4, [200, 30, 30], 12); d.px(7, 5, [60, 10, 10]);
});
T('tall_grass', d => {
  d.fill([0,0,0], 0, 0);
  for (let k = 0; k < 8; k++) {
    const x = 1 + (d.rng() * 14) | 0, h = 5 + (d.rng() * 9) | 0;
    for (let y = 0; y < h; y++) d.px(x + ((y > h*0.6 && d.rng()<0.4) ? 1 : 0), 15 - y, [88, 150, 50, 255], 255);
  }
});
T('sapling', d => {
  d.fill([0,0,0], 0, 0);
  d.rect(7, 9, 2, 7, [104, 82, 50], 6);
  d.rect(4, 3, 8, 6, [58, 122, 40], 16);
  d.px(7, 2, [58, 122, 40]); d.px(8, 2, [58, 122, 40]);
});
T('obsidian', d => { d.fill([24, 18, 38], 8); d.speckle([60, 44, 90], 20, 10); d.speckle([10, 8, 18], 24, 4); });
T('mossy_cobblestone', d => {
  d.fill([110, 110, 110], 16);
  for (let k = 0; k < 6; k++) { const g = 100 + d.rng() * 40; d.rect((d.rng()*13)|0, (d.rng()*13)|0, 3, 3, [g, g, g], 8); }
  d.speckle([88, 128, 60], 40, 12);
});
T('farmland', d => { d.fill([96, 62, 38], 10); for (const x of [2, 6, 10, 14]) d.rect(x, 0, 1, 16, [70, 44, 26], 5); });
T('wheat_crop', d => {
  d.fill([0,0,0], 0, 0);
  for (const x of [2, 5, 8, 11, 14]) {
    d.rect(x, 4, 1, 12, [190, 170, 70], 10);
    d.px(x - 1, 4, [220, 200, 90]); d.px(x, 3, [220, 200, 90]);
  }
});
T('bookshelf', d => {
  d.fill([160, 129, 79], 8);
  d.rect(1, 2, 14, 5, [70, 50, 32], 4); d.rect(1, 9, 14, 5, [70, 50, 32], 4);
  const cs = [[170,40,40],[40,90,170],[40,140,60],[200,170,60],[150,60,160]];
  let x = 1;
  for (let row of [2, 9]) { x = 1; while (x < 15) { const w = 2 + (d.rng()*2|0); d.rect(x, row, Math.min(w, 15-x), 5, cs[(d.rng()*cs.length)|0], 12); x += w; } }
});
T('brick_block', d => {
  d.fill([150, 97, 83], 8);
  for (const y of [0, 4, 8, 12]) d.rect(0, y, 16, 1, [180, 180, 180], 6);
  for (let r = 0; r < 4; r++) for (let x = (r % 2) * 4 + 2; x < 16; x += 8) d.rect(x, r * 4 + 1, 1, 3, [180, 180, 180], 6);
});
T('stone_bricks', d => {
  d.fill([122, 122, 122], 8);
  for (const y of [0, 8]) d.rect(0, y, 16, 1, [80, 80, 80], 5);
  d.rect(7, 1, 1, 7, [80, 80, 80], 5); d.rect(3, 9, 1, 7, [80, 80, 80], 5); d.rect(11, 9, 1, 7, [80, 80, 80], 5);
});
T('lava', d => { d.fill([207, 92, 20], 26); d.speckle([255, 200, 60], 36, 20); d.speckle([120, 30, 10], 26, 10); });
T('ice', d => { d.fill([160, 200, 250], 8, 220); d.px(3,3,[230,244,255]); d.px(4,4,[230,244,255]); d.px(11,9,[230,244,255]); d.px(12,10,[230,244,255]); });
T('pumpkin_side', d => { d.fill([197, 116, 24], 10); for (const x of [2, 6, 10, 14]) d.rect(x, 0, 1, 16, [160, 90, 16], 6); });
T('pumpkin_top', d => { d.fill([170, 100, 20], 10); d.rect(6, 6, 3, 3, [90, 120, 40], 6); });
T('red_mushroom', d => {
  d.fill([0,0,0],0,0);
  d.rect(7, 9, 2, 7, [226, 220, 200], 6);
  d.rect(4, 4, 8, 5, [200, 40, 40], 10);
  d.px(6, 5, [255,255,255]); d.px(9, 6, [255,255,255]); d.px(5, 7, [255,255,255]);
});
T('brown_mushroom', d => {
  d.fill([0,0,0],0,0);
  d.rect(7, 9, 2, 7, [226, 220, 200], 6);
  d.rect(5, 5, 6, 4, [140, 100, 62], 10);
});
T('chest_side', d => {
  d.fill([158, 116, 56], 8); d.border([90, 64, 30], 5);
  d.rect(0, 9, 16, 1, [90, 64, 30], 4);
});
T('chest_front', d => {
  d.fill([158, 116, 56], 8); d.border([90, 64, 30], 5);
  d.rect(0, 9, 16, 1, [90, 64, 30], 4);
  d.rect(7, 7, 2, 4, [140, 140, 140], 8);
});
T('chest_top', d => { d.fill([158, 116, 56], 8); d.border([90, 64, 30], 5); });
T('tnt_side', d => {
  d.fill([190, 60, 40], 12);
  d.rect(0, 5, 16, 6, [225, 220, 205], 6);
  // "TNT"
  const c = [30, 30, 30];
  d.rect(2, 6, 3, 1, c); d.rect(3, 6, 1, 4, c);           // T
  d.rect(6, 6, 1, 4, c); d.rect(9, 6, 1, 4, c); d.px(7, 7, c); d.px(8, 8, c); // N
  d.rect(11, 6, 3, 1, c); d.rect(12, 6, 1, 4, c);         // T
  d.rect(0, 0, 16, 1, [120, 30, 20], 6); d.rect(0, 15, 16, 1, [120, 30, 20], 6);
});
T('tnt_top', d => {
  d.fill([190, 60, 40], 12);
  d.rect(6, 6, 4, 4, [225, 220, 205], 4);
  d.rect(7, 7, 2, 2, [40, 40, 40]);
});
T('bed_top', d => {
  d.fill([170, 30, 30], 10);
  d.rect(0, 0, 16, 5, [235, 235, 235], 6);       // pillow
  d.rect(0, 5, 16, 1, [120, 16, 16], 4);
  d.border([120, 60, 30], 6);
});
T('bed_side', d => {
  // half-height blocks sample only the bottom half of the tile
  d.fill([170, 30, 30], 10);
  d.rect(0, 8, 16, 1, [235, 235, 235], 6);
  d.rect(0, 13, 16, 3, [130, 96, 56], 8);
});

// ---------------- assign block tiles ----------------
function tiles(name, top, bottom, side, front) {
  Blocks[B[name]].tiles = { top: TileIdx[top], bottom: TileIdx[bottom], side: TileIdx[side], front: front ? TileIdx[front] : TileIdx[side] };
}
tiles('grass_block', 'grass_top', 'dirt', 'grass_side');
tiles('dirt', 'dirt', 'dirt', 'dirt');
tiles('stone', 'stone', 'stone', 'stone');
tiles('cobblestone', 'cobblestone', 'cobblestone', 'cobblestone');
tiles('bedrock', 'bedrock', 'bedrock', 'bedrock');
tiles('sand', 'sand', 'sand', 'sand');
tiles('gravel', 'gravel', 'gravel', 'gravel');
tiles('oak_log', 'log_top', 'log_top', 'oak_log');
tiles('oak_leaves', 'oak_leaves', 'oak_leaves', 'oak_leaves');
tiles('oak_planks', 'oak_planks', 'oak_planks', 'oak_planks');
tiles('water', 'water', 'water', 'water');
tiles('glass', 'glass', 'glass', 'glass');
tiles('coal_ore', 'coal_ore', 'coal_ore', 'coal_ore');
tiles('iron_ore', 'iron_ore', 'iron_ore', 'iron_ore');
tiles('gold_ore', 'gold_ore', 'gold_ore', 'gold_ore');
tiles('diamond_ore', 'diamond_ore', 'diamond_ore', 'diamond_ore');
tiles('crafting_table', 'table_top', 'oak_planks', 'table_side');
tiles('furnace', 'furnace_side', 'furnace_side', 'furnace_side', 'furnace_front');
tiles('furnace_lit', 'furnace_side', 'furnace_side', 'furnace_side', 'furnace_front_lit');
tiles('torch', 'torch', 'torch', 'torch');
tiles('snowy_grass', 'snow', 'dirt', 'snowy_grass_side');
tiles('snow_block', 'snow', 'snow', 'snow');
tiles('cactus', 'cactus_top', 'cactus_top', 'cactus_side');
tiles('sandstone', 'sandstone_side', 'sandstone_side', 'sandstone_side');
tiles('birch_log', 'log_top', 'log_top', 'birch_log');
tiles('spruce_log', 'log_top', 'log_top', 'spruce_log');
tiles('spruce_leaves', 'spruce_leaves', 'spruce_leaves', 'spruce_leaves');
tiles('dandelion', 'dandelion', 'dandelion', 'dandelion');
tiles('poppy', 'poppy', 'poppy', 'poppy');
tiles('tall_grass', 'tall_grass', 'tall_grass', 'tall_grass');
tiles('oak_sapling', 'sapling', 'sapling', 'sapling');
tiles('obsidian', 'obsidian', 'obsidian', 'obsidian');
tiles('mossy_cobblestone', 'mossy_cobblestone', 'mossy_cobblestone', 'mossy_cobblestone');
tiles('oak_wood_top', 'log_top', 'log_top', 'log_top');
tiles('farmland', 'farmland', 'dirt', 'dirt');
tiles('wheat_crop', 'wheat_crop', 'wheat_crop', 'wheat_crop');
tiles('bookshelf', 'oak_planks', 'oak_planks', 'bookshelf');
tiles('brick_block', 'brick_block', 'brick_block', 'brick_block');
tiles('stone_bricks', 'stone_bricks', 'stone_bricks', 'stone_bricks');
tiles('lava', 'lava', 'lava', 'lava');
tiles('ice', 'ice', 'ice', 'ice');
tiles('pumpkin', 'pumpkin_top', 'pumpkin_top', 'pumpkin_side');
tiles('red_mushroom', 'red_mushroom', 'red_mushroom', 'red_mushroom');
tiles('brown_mushroom', 'brown_mushroom', 'brown_mushroom', 'brown_mushroom');
tiles('chest', 'chest_top', 'chest_top', 'chest_side', 'chest_front');
tiles('wool', 'sheep_wool', 'sheep_wool', 'sheep_wool');
tiles('bed', 'bed_top', 'oak_planks', 'bed_side');
tiles('stone_slab', 'stone', 'stone', 'stone');
tiles('oak_slab', 'oak_planks', 'oak_planks', 'oak_planks');
tiles('tnt', 'tnt_top', 'tnt_top', 'tnt_side');

// ---------------- item icons ----------------
function toolIcon(name, kind, headC, handleC = [104, 82, 50]) {
  const H = handleC, M = headC, D = [M[0]*0.65, M[1]*0.65, M[2]*0.65];
  const maps = { h: H, m: M, d: D };
  const pats = {
    pickaxe: [
      '....mmmmmm......',
      '..mm......mm....',
      '.m..........m...',
      '.m....hh.....m..',
      '.....h..d....d..',
      '....h...........',
      '...h............',
      '..h.............',
      '.h..............',
      'h...............',
    ],
    axe: [
      '....mmm.........',
      '...mmmmm........',
      '..mmmmmmm.......',
      '..mmm..hh.......',
      '..mm..h.........',
      '.....h..........',
      '....h...........',
      '...h............',
      '..h.............',
      '.h..............',
    ],
    shovel: [
      '......mmm.......',
      '.....mmmmm......',
      '.....mmmmm......',
      '......mdm.......',
      '......h.........',
      '.....h..........',
      '....h...........',
      '...h............',
      '..h.............',
      '.h..............',
    ],
    sword: [
      '..........mm....',
      '.........mmm....',
      '........mmm.....',
      '.......mmm......',
      '......mmm.......',
      '.....mmm........',
      '.hh.mmm.........',
      '..hhmm..........',
      '..hhh...........',
      '.h..hh..........',
    ],
  };
  return T(name, d => { d.fill([0,0,0],0,0); d.pat(pats[kind].map(r => r.padEnd(16, '.')), maps); });
}
const TIER_COLORS = { wooden: [140, 110, 62], stone: [140, 140, 140], iron: [216, 216, 216], golden: [250, 220, 60], diamond: [80, 225, 210] };
for (const pre of Object.keys(TIER_COLORS))
  for (const kind of ['pickaxe', 'axe', 'shovel', 'sword'])
    Items[I[pre + '_' + kind]].icon = toolIcon(pre + '_' + kind, kind, TIER_COLORS[pre]);

function icon(name, fn) { Items[I[name]].icon = T('i_' + name, fn); }
icon('stick', d => { d.fill([0,0,0],0,0); for (let i = 0; i < 10; i++) d.px(3 + i, 13 - i, [104, 82, 50]); for (let i = 0; i < 10; i++) d.px(4 + i, 13 - i, [130, 104, 60]); });
icon('coal', d => { d.fill([0,0,0],0,0); d.rect(4, 4, 8, 8, [38, 38, 38], 10); d.px(5,5,[80,80,80]); d.px(10,9,[10,10,10]); d.px(6,10,[70,70,70]); });
icon('charcoal', d => { d.fill([0,0,0],0,0); d.rect(4, 4, 8, 8, [50, 40, 32], 10); d.px(6,6,[90,74,60]); d.px(9,9,[20,16,12]); });
icon('iron_ingot', d => { d.fill([0,0,0],0,0); d.pat(['................','................','................','.....dddddd.....','....dmmmmmmd....','...dmmmmmmmmd...','..dmmmmmmmmmmd..','..mmmmmmmmmmmm..','..dddddddddddd..'], { m: [225, 225, 225], d: [150, 150, 150] }); });
icon('gold_ingot', d => { d.fill([0,0,0],0,0); d.pat(['................','................','................','.....dddddd.....','....dmmmmmmd....','...dmmmmmmmmd...','..dmmmmmmmmmmd..','..mmmmmmmmmmmm..','..dddddddddddd..'], { m: [252, 222, 80], d: [190, 150, 30] }); });
icon('diamond', d => { d.fill([0,0,0],0,0); d.pat(['................','....dmmmmd......','...dmmmmmmd.....','..dmmmmmmmmd....','...mmmmmmmm.....','....mmmmmm......','.....mmmm.......','......mm........'], { m: [90, 230, 220], d: [200, 255, 250] }); });
icon('apple', d => { d.fill([0,0,0],0,0); d.rect(5, 6, 7, 7, [210, 40, 40], 14); d.px(5,6,[0,0,0],0); d.px(11,6,[0,0,0],0); d.px(5,12,[0,0,0],0); d.px(11,12,[0,0,0],0); d.px(8, 4, [104, 82, 50]); d.px(8, 5, [104, 82, 50]); d.px(9, 4, [58, 122, 40]); d.px(6, 7, [255, 150, 150]); });
icon('bread', d => { d.fill([0,0,0],0,0); for (let i = 0; i < 9; i++) { d.px(3 + i, 6 + ((i/3)|0), [200, 150, 70]); d.px(3 + i, 7 + ((i/3)|0), [225, 180, 100]); d.px(3 + i, 8 + ((i/3)|0), [170, 120, 50]); } });
icon('wheat', d => { d.fill([0,0,0],0,0); for (const x of [4, 8, 12]) { d.rect(x, 3, 1, 11, [180, 160, 60], 8); d.px(x-1, 4, [220, 200, 90]); d.px(x+1, 5, [220, 200, 90]); d.px(x-1, 7, [220, 200, 90]); } });
icon('wheat_seeds', d => { d.fill([0,0,0],0,0); for (let k = 0; k < 9; k++) d.px(3 + ((d.rng()*10)|0), 4 + ((d.rng()*8)|0), [60, 160, 60]); });
icon('porkchop', d => { d.fill([0,0,0],0,0); d.rect(4, 5, 9, 7, [250, 130, 140], 12); d.rect(5, 7, 2, 3, [255, 220, 220], 6); });
icon('cooked_porkchop', d => { d.fill([0,0,0],0,0); d.rect(4, 5, 9, 7, [190, 120, 60], 12); d.rect(5, 7, 2, 3, [230, 180, 120], 6); });
icon('beef', d => { d.fill([0,0,0],0,0); d.rect(4, 5, 9, 7, [200, 50, 50], 12); d.rect(6, 6, 4, 1, [255, 230, 230], 6); });
icon('steak', d => { d.fill([0,0,0],0,0); d.rect(4, 5, 9, 7, [120, 70, 40], 12); d.rect(6, 6, 4, 1, [90, 50, 26], 6); });
icon('chicken', d => { d.fill([0,0,0],0,0); d.rect(5, 5, 6, 8, [240, 200, 190], 10); d.px(6, 4, [240, 200, 190]); d.px(10, 13, [230, 180, 170]); });
icon('cooked_chicken', d => { d.fill([0,0,0],0,0); d.rect(5, 5, 6, 8, [200, 140, 70], 10); d.px(6, 4, [200, 140, 70]); });
icon('rotten_flesh', d => { d.fill([0,0,0],0,0); d.rect(4, 5, 9, 7, [150, 90, 60], 16); d.speckle([90, 130, 60], 14, 10); });
icon('bone', d => { d.fill([0,0,0],0,0); for (let i = 0; i < 8; i++) d.px(4 + i, 11 - i, [235, 235, 220]); d.px(3, 12, [235,235,220]); d.px(4, 13, [235,235,220]); d.px(11, 3, [235,235,220]); d.px(12, 4, [235,235,220]); });
icon('arrow', d => { d.fill([0,0,0],0,0); for (let i = 0; i < 9; i++) d.px(3 + i, 12 - i, [104, 82, 50]); d.px(12, 3, [200, 200, 200]); d.px(11, 3, [200,200,200]); d.px(12, 4, [200,200,200]); d.px(4, 12, [240,240,240]); d.px(3, 12, [240,240,240]); d.px(4, 13, [240,240,240]); });
icon('string', d => { d.fill([0,0,0],0,0); for (let y = 2; y < 14; y++) d.px(7 + ((y % 4 < 2) ? 0 : 1), y, [240, 240, 240]); });
icon('gunpowder', d => { d.fill([0,0,0],0,0); for (let k = 0; k < 16; k++) d.px(3 + ((d.rng()*10)|0), 4 + ((d.rng()*9)|0), [70, 70, 70]); });
icon('leather', d => { d.fill([0,0,0],0,0); d.rect(4, 4, 9, 9, [170, 100, 50], 12); d.px(4,4,[0,0,0],0); d.px(12,12,[0,0,0],0); });
icon('feather', d => { d.fill([0,0,0],0,0); for (let i = 0; i < 9; i++) { d.px(4 + i, 12 - i, [240, 240, 240]); d.px(5 + i, 12 - i, [210, 210, 215]); } });
icon('flint', d => { d.fill([0,0,0],0,0); d.rect(5, 5, 7, 7, [60, 60, 65], 8); d.px(5,5,[0,0,0],0); d.px(11,11,[0,0,0],0); });
icon('egg', d => { d.fill([0,0,0],0,0); d.rect(6, 5, 4, 7, [240, 230, 200], 6); d.px(6,5,[0,0,0],0); d.px(9,5,[0,0,0],0); d.px(6,11,[0,0,0],0); d.px(9,11,[0,0,0],0); });
icon('bow', d => {
  d.fill([0,0,0],0,0);
  // curved stave
  const w = [104, 82, 50], s = [230, 230, 230];
  for (let i = 0; i < 5; i++) { d.px(4 + i, 2 + (i > 2 ? 1 : 0), w); d.px(2 + (i > 2 ? 1 : 0), 4 + i, w); }
  d.px(9, 4, w); d.px(10, 5, w); d.px(11, 6, w); d.px(4, 9, w); d.px(5, 10, w); d.px(6, 11, w);
  d.px(12, 7, w); d.px(12, 8, w); d.px(7, 12, w); d.px(8, 12, w);
  for (let i = 0; i < 9; i++) d.px(11 - i + 2, 3 + i, s);   // string
});

// ---------------- mob skin tiles ----------------
T('zombie_face', d => {
  d.fill([70, 140, 60], 10);
  d.rect(3, 5, 2, 2, [20, 20, 20]); d.rect(11, 5, 2, 2, [20, 20, 20]);
  d.rect(6, 10, 4, 2, [40, 80, 36], 6);
});
T('zombie_skin', d => { d.fill([70, 140, 60], 12); d.speckle([54, 110, 46], 20, 8); });
T('zombie_shirt', d => { d.fill([60, 120, 160], 10); d.speckle([44, 96, 132], 16, 8); });
T('zombie_pants', d => { d.fill([60, 60, 120], 10); });
T('skel_face', d => {
  d.fill([200, 200, 200], 8);
  d.rect(3, 5, 2, 2, [40, 40, 40]); d.rect(11, 5, 2, 2, [40, 40, 40]);
  d.rect(5, 10, 6, 1, [80, 80, 80]);
});
T('skel_bone', d => { d.fill([200, 200, 200], 10); d.rect(0, 4, 16, 1, [140, 140, 140], 6); d.rect(0, 11, 16, 1, [140, 140, 140], 6); });
T('creeper_face', d => {
  d.fill([70, 180, 70], 16);
  d.rect(3, 4, 3, 3, [10, 10, 10]); d.rect(10, 4, 3, 3, [10, 10, 10]);
  d.rect(6, 7, 4, 4, [10, 10, 10]); d.rect(5, 9, 2, 4, [10, 10, 10]); d.rect(9, 9, 2, 4, [10, 10, 10]);
});
T('creeper_skin', d => { d.fill([70, 180, 70], 24); d.speckle([50, 140, 50], 34, 14); d.speckle([100, 210, 100], 20, 10); });
T('cow_body', d => { d.fill([90, 60, 40], 10); d.rect(2, 3, 5, 5, [240, 240, 240], 6); d.rect(9, 9, 5, 4, [240, 240, 240], 6); });
T('cow_face', d => {
  d.fill([90, 60, 40], 10);
  d.rect(3, 5, 2, 2, [20, 20, 20]); d.rect(11, 5, 2, 2, [20, 20, 20]);
  d.rect(4, 10, 8, 5, [230, 200, 200], 6);
  d.px(5, 12, [120, 90, 90]); d.px(10, 12, [120, 90, 90]);
});
T('pig_skin', d => { d.fill([240, 160, 160], 8); d.speckle([220, 140, 140], 16, 6); });
T('pig_face', d => {
  d.fill([240, 160, 160], 8);
  d.rect(3, 5, 2, 2, [20, 20, 20]); d.rect(11, 5, 2, 2, [20, 20, 20]);
  d.rect(5, 8, 6, 4, [220, 120, 130], 6);
  d.px(6, 10, [120, 60, 60]); d.px(9, 10, [120, 60, 60]);
});
T('sheep_wool', d => { d.fill([235, 235, 235], 10); d.speckle([215, 215, 215], 30, 6); });
T('sheep_face', d => {
  d.fill([220, 200, 180], 8);
  d.rect(3, 6, 2, 2, [20, 20, 20]); d.rect(11, 6, 2, 2, [20, 20, 20]);
});
T('chicken_body', d => { d.fill([235, 235, 235], 8); });
T('chicken_face', d => {
  d.fill([235, 235, 235], 8);
  d.rect(3, 5, 2, 2, [20, 20, 20]); d.rect(11, 5, 2, 2, [20, 20, 20]);
  d.rect(6, 9, 4, 2, [230, 180, 40]); d.rect(6, 11, 4, 2, [200, 40, 40]);
});
T('spider_skin', d => { d.fill([50, 40, 40], 10); d.speckle([80, 60, 50], 20, 8); });
T('spider_face', d => {
  d.fill([50, 40, 40], 10);
  d.rect(3, 5, 2, 2, [200, 30, 30]); d.rect(11, 5, 2, 2, [200, 30, 30]);
  d.rect(6, 4, 1, 1, [200, 30, 30]); d.rect(9, 4, 1, 1, [200, 30, 30]);
});
T('white', d => d.fill([255, 255, 255], 0));
T('skin', d => { d.fill([232, 190, 152], 8); d.speckle([210, 168, 130], 16, 6); });
T('xp', d => {
  d.fill([0, 0, 0], 0, 0);
  d.rect(5, 5, 6, 6, [120, 240, 60], 20);
  d.rect(6, 6, 4, 4, [220, 255, 120], 14);
  d.px(7, 7, [255, 255, 200]); d.px(8, 8, [255, 255, 200]);
});

// ---------------------------------------------------------------- breaking overlay
// Ten cumulative destroy stages, like the real game: a hairline crack opens at
// the centre of the face and spreads outward into a web, and every crack drawn
// in an earlier stage is still there in the later ones.
const CRACK_T = new Float32Array(256).fill(Infinity);
(function buildCrackPattern() {
  const rng = mulberry32(0x5EED9);
  const set = (x, y, t) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    const i = y * 16 + x;
    if (t < CRACK_T[i]) CRACK_T[i] = t;
  };
  const BRANCHES = 8;
  for (let b = 0; b < BRANCHES; b++) {
    // each fissure opens at a different point in the dig, so the face goes
    // hairline -> a few cracks -> a full web instead of blotching all at once
    const start = 0.015 + (b / BRANCHES) * 0.55;
    const base = (b / BRANCHES) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    let ang = base;
    let x = 7.5 + Math.cos(base) * 1.8, y = 7.5 + Math.sin(base) * 1.8;
    const len = 13 + rng() * 5;
    for (let s2 = 0; s2 < len; s2++) {
      const f = s2 / len;
      const t = start + f * (1 - start) * 0.99 + rng() * 0.02;
      set(x, y, t);
      // cracks only widen once they have run a way out, keeping them hairline early
      if (f > 0.45 && rng() < 0.24) {
        const perp = ang + Math.PI / 2;
        set(x + Math.cos(perp), y + Math.sin(perp), t + 0.04);
      }
      // side fissures spidering off the main crack
      if (s2 > 3 && rng() < 0.28) {
        let fa = ang + (rng() < 0.5 ? 1 : -1) * (0.7 + rng() * 0.7);
        let fx = x, fy = y;
        const fl = 2 + rng() * 4;
        for (let k = 0; k < fl; k++) {
          set(fx, fy, t + 0.05 + k * 0.02);
          fa += (rng() - 0.5) * 0.7;
          fx += Math.cos(fa); fy += Math.sin(fa);
        }
      }
      ang += (rng() - 0.5) * 0.95;      // jagged...
      ang = ang * 0.7 + base * 0.3;     // ...but still travelling outward
      x += Math.cos(ang); y += Math.sin(ang);
    }
  }
})();
for (let stage = 0; stage < 10; stage++) {
  T('crack' + stage, d => {
    d.fill([0, 0, 0], 0, 0);
    const lim = (stage + 1) / 10;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (CRACK_T[y * 16 + x] > lim) continue;
      d.px(x, y, [14, 12, 12], 240);
      // a chipped highlight below each crack pixel reads as depth
      if (CRACK_T[(y + 1) * 16 + x] > lim && d.rng() < 0.45)
        d.px(x, y + 1, [150, 150, 150], 70);
    }
  });
}

// item icons for block-items are drawn from block tiles (fake iso cube)
function drawItemIcon(ctx, id, size) {
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;
  if (id >= 256) {
    const t = Items[id].icon ?? TileIdx.white;
    const [sx, sy] = tileXY(t);
    ctx.drawImage(atlasCanvas, sx, sy, TILE, TILE, 0, 0, size, size);
    return;
  }
  const b = Blocks[id];
  if (!b || !b.tiles) return;
  if (b.rt === RT_CROSS || b.rt === RT_TORCH || b.rt === RT_WATER) {
    const [sx, sy] = tileXY(b.tiles.side);
    ctx.drawImage(atlasCanvas, sx, sy, TILE, TILE, 0, 0, size, size);
    return;
  }
  // fake isometric cube: top rhombus + two side faces
  const s = size, half = s / 2, qh = s / 4;
  const [tx, ty] = tileXY(b.tiles.top);
  const [lx, ly] = tileXY(b.tiles.side);
  const [rx, ry] = tileXY(b.tiles.front);
  // left face
  ctx.save();
  ctx.setTransform(half / TILE, qh / TILE, 0, (s - qh) / TILE / 1.55, 0, qh);
  ctx.filter = 'brightness(0.72)';
  ctx.drawImage(atlasCanvas, lx, ly, TILE, TILE, 0, 0, TILE, TILE);
  ctx.restore();
  // right face
  ctx.save();
  ctx.setTransform(half / TILE, -qh / TILE, 0, (s - qh) / TILE / 1.55, half, half);
  ctx.filter = 'brightness(0.55)';
  ctx.drawImage(atlasCanvas, rx, ry, TILE, TILE, 0, 0, TILE, TILE);
  ctx.restore();
  // top face
  ctx.save();
  ctx.setTransform(half / TILE, qh / TILE, -half / TILE, qh / TILE, half, 0);
  ctx.drawImage(atlasCanvas, tx, ty, TILE, TILE, 0, 0, TILE, TILE);
  ctx.restore();
  ctx.filter = 'none';
}
