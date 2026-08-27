'use strict';
// ---------------------------------------------------------------- procedural texture atlas
// 16px tiles in a 32x32 grid (512x512 canvas). Everything is drawn in code.

const ATLAS_TILES = 32, TILE = 16, ATLAS_PX = ATLAS_TILES * TILE;  // 512px, room for every dimension
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
      // round first: a fractional index writes to nothing at all on a typed array
      x = Math.round(x); y = Math.round(y);
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


// ---------------- pixel-art helpers ----------------
// Coherent, quantised mottling: block textures read as a few flat shades of one
// colour rather than per-pixel static, which is what makes them look drawn.
function mottle(d, base, amp, scale, levels, seed) {
  const rng = mulberry32(seed ^ 0x9E37);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    // two octaves keep the patches coherent while the grain stays per-pixel
    const n = (noise2(seed, x / scale, y / scale) * 0.65 +
               noise2(seed ^ 0x33, x / (scale * 0.42), y / (scale * 0.42)) * 0.35) - 0.5;
    const q = Math.round(n * 2 * levels) / levels;
    const v = q * amp + (rng() - 0.5) * amp * 0.45;
    d.px(x, y, [base[0] + v, base[1] + v, base[2] + v]);
  }
}
// Irregular stones packed together, each with a darker gap around it.
function cobbles(d, seedPts, base, spread, mortar, seed) {
  const pts = [];
  const rng = mulberry32(seed);
  for (let i = 0; i < seedPts; i++)
    pts.push([rng() * 16, rng() * 16, base + (rng() - 0.5) * spread]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let best = 1e9, second = 1e9, tone = base, near = null;
    for (const p of pts) {
      // wrap so the stones meet cleanly at the tile edges
      const dx = Math.min(Math.abs(x - p[0]), 16 - Math.abs(x - p[0]));
      const dy = Math.min(Math.abs(y - p[1]), 16 - Math.abs(y - p[1]));
      const dd = dx * dx + dy * dy;
      if (dd < best) { second = best; best = dd; tone = p[2]; near = p; }
      else if (dd < second) second = dd;
    }
    const edge = Math.sqrt(second) - Math.sqrt(best) < 1.35;
    let g;
    if (edge) g = mortar;
    else {
      // light each stone from the top-left so it reads as rounded
      const sx = x - near[0], sy = y - near[1];
      g = tone - (sx + sy) * 2.6 + (noise2(seed, x / 2.2, y / 2.2) - 0.5) * 12;
    }
    d.px(x, y, [g, g, g]);
  }
}
// An ore pocket: an irregular clump of colour with a dark rim, like the real ones.
function oreBlob(d, cx, cy, r, col, rng) {
  const cells = [];
  const R = Math.ceil(r);
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const dd = Math.hypot(x, y) + (rng() - 0.5) * 0.9;
    if (dd <= r) cells.push([cx + x, cy + y]);
  }
  // rim first, then the ore over the top
  for (const [x, y] of cells) for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1]])
    d.px(x + ox, y + oy, [col[0] * 0.35, col[1] * 0.35, col[2] * 0.35]);
  for (const [x, y] of cells) {
    const hi = rng() < 0.35;
    d.px(x, y, hi ? [Math.min(255, col[0] * 1.25), Math.min(255, col[1] * 1.25), Math.min(255, col[2] * 1.25)] : col);
  }
}
function oreTile2(name, oreCol, blobs, seed) {
  return T(name, d => {
    mottle(d, [126, 126, 126], 22, 3.0, 3, seed);
    const rng = mulberry32(seed ^ 0x5A5A);
    const spots = [];
    for (let i = 0; i < blobs; i++) {
      let x, y, tries = 0;
      do { x = 2 + (rng() * 12) | 0; y = 2 + (rng() * 12) | 0; tries++; }
      while (tries < 24 && spots.some(s => Math.hypot(s[0] - x, s[1] - y) < 4.2));
      spots.push([x, y]);
      oreBlob(d, x, y, 0.95 + rng() * 0.7, oreCol, rng);
    }
  });
}

// ---------------- terrain tiles ----------------
T('grass_top', d => {
  mottle(d, [110, 156, 74], 30, 3.2, 3, 0x611);
  // darker tufts scattered through the sward
  const rng = mulberry32(0x612);
  for (let k = 0; k < 26; k++) {
    const x = (rng() * 16) | 0, y = (rng() * 16) | 0;
    d.px(x, y, [88, 130, 58]);
    if (rng() < 0.5) d.px(x, y + 1, [82, 122, 54]);
  }
  for (let k = 0; k < 14; k++) d.px((rng() * 16) | 0, (rng() * 16) | 0, [132, 178, 92]);
});
T('dirt', d => {
  mottle(d, [134, 96, 64], 26, 3.0, 3, 0x621);
  const rng = mulberry32(0x622);
  for (let k = 0; k < 22; k++) {
    const x = (rng() * 16) | 0, y = (rng() * 16) | 0;
    d.px(x, y, [104, 72, 46]);
    if (rng() < 0.4) d.px(x + 1, y, [110, 78, 50]);
  }
  for (let k = 0; k < 10; k++) d.px((rng() * 16) | 0, (rng() * 16) | 0, [160, 122, 86]);
});
T('grass_side', d => {
  mottle(d, [134, 96, 64], 26, 3.0, 3, 0x621);
  const rng = mulberry32(0x631);
  for (let k = 0; k < 18; k++) d.px((rng() * 16) | 0, 3 + ((rng() * 13) | 0), [104, 72, 46]);
  // the grass hangs over the dirt in a ragged fringe, never a straight line
  for (let x = 0; x < 16; x++) {
    const depth = 1 + Math.round(noise2(0x632, x / 2.4, 0) * 2.6);
    for (let y = 0; y <= depth; y++) {
      const shade = y === depth ? [92, 134, 60] : [110, 156, 74];
      const v = (rng() - 0.5) * 16;
      d.px(x, y, [shade[0] + v, shade[1] + v, shade[2] + v]);
    }
    if (rng() < 0.4) d.px(x, depth + 1, [96, 138, 62]);
  }
});
T('stone', d => {
  mottle(d, [128, 128, 128], 22, 2.8, 3, 0x641);
  const rng = mulberry32(0x642);
  // a few soft darker seams, the way stone weathers
  for (let k = 0; k < 5; k++) {
    let x = (rng() * 16) | 0, y = (rng() * 16) | 0;
    const len = 2 + (rng() * 4) | 0;
    for (let i = 0; i < len; i++) {
      d.px(x, y, [104, 104, 104]);
      x += rng() < 0.7 ? 1 : 0; y += rng() < 0.3 ? 1 : 0;
    }
  }
  for (let k = 0; k < 8; k++) d.px((rng() * 16) | 0, (rng() * 16) | 0, [146, 146, 146]);
});
T('cobblestone', d => cobbles(d, 12, 132, 62, 72, 0x651));
T('bedrock', d => {
  cobbles(d, 9, 74, 62, 40, 0x6F1);
  const rng = mulberry32(0x6F2);
  for (let k = 0; k < 26; k++) d.px((rng() * 16) | 0, (rng() * 16) | 0, [34, 34, 34]);
  for (let k = 0; k < 14; k++) d.px((rng() * 16) | 0, (rng() * 16) | 0, [112, 112, 112]);
});
T('sand', d => {
  mottle(d, [219, 207, 160], 16, 3.6, 3, 0x671);
  const rng = mulberry32(0x672);
  for (let k = 0; k < 24; k++) d.px((rng() * 16) | 0, (rng() * 16) | 0, [200, 187, 140]);
  for (let k = 0; k < 12; k++) d.px((rng() * 16) | 0, (rng() * 16) | 0, [236, 226, 186]);
});
T('gravel', d => {
  cobbles(d, 22, 126, 66, 84, 0x661);
  const rng = mulberry32(0x662);
  for (let k = 0; k < 20; k++) d.px((rng() * 16) | 0, (rng() * 16) | 0, [168, 164, 158]);
  for (let k = 0; k < 16; k++) d.px((rng() * 16) | 0, (rng() * 16) | 0, [86, 82, 78]);
});
T('oak_log', d => {
  mottle(d, [110, 86, 52], 18, 3.0, 3, 1697);
  const rng = mulberry32(1702);
  // vertical grain at irregular intervals
  let x = 0;
  while (x < 16) {
    const w = 1 + ((rng() * 2) | 0);
    for (let y = 0; y < 16; y++) {
      if (rng() < 0.82) for (let i = 0; i < w; i++) {
        const v = (rng() - 0.5) * 10;
        d.px(x + i, y, [80 + v, 62 + v, 36 + v]);
      }
    }
    x += w + 1 + ((rng() * 2) | 0);
  }
});
T('log_top', d => {
  // growth rings, then the bark edge
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const r = Math.hypot(x - 7.5, y - 7.5) + noise2(0x691, x / 3, y / 3) * 1.1;
    const ring = Math.sin(r * 2.3) > 0 ? 0 : 1;
    const base = ring ? [150, 116, 68] : [176, 142, 92];
    const v = (noise2(0x692, x / 4, y / 4) - 0.5) * 12;
    d.px(x, y, [base[0] + v, base[1] + v, base[2] + v]);
  }
  d.border([104, 82, 50], 8);
  for (let i = 1; i < 15; i++) { d.px(i, 1, [116, 92, 56]); d.px(i, 14, [116, 92, 56]); d.px(1, i, [116, 92, 56]); d.px(14, i, [116, 92, 56]); }
  d.px(7, 7, [128, 98, 58]); d.px(8, 8, [128, 98, 58]);
});
T('oak_leaves', d => {
  d.fill([0, 0, 0], 0, 0);
  const rng = mulberry32(1713);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = noise2(1714, x / 2.6, y / 2.6);
    if (n < 0.21) continue;                       // gaps you can see sky through
    const q = Math.round((n - 0.5) * 4) / 4;
    const v = q * 42 + (rng() - 0.5) * 16;
    d.px(x, y, [60 + v, 118 + v, 44 + v]);
  }
  // a few bright leaves catching the light
  for (let k = 0; k < 12; k++) {
    const x = (rng() * 16) | 0, y = (rng() * 16) | 0;
    if (d.get(x, y)[3] > 0) d.px(x, y, [81, 153, 59]);
  }
});
T('oak_planks', d => {
  const rng = mulberry32(0x681);
  const tones = [[168, 134, 84], [156, 124, 76], [176, 142, 90], [162, 130, 80]];
  for (let b = 0; b < 4; b++) {
    const t = tones[b];
    for (let y = b * 4; y < b * 4 + 4; y++) for (let x = 0; x < 16; x++) {
      const v = (noise2(0x682 + b, x / 5, y) - 0.5) * 18;
      d.px(x, y, [t[0] + v, t[1] + v, t[2] + v]);
    }
    // the seam between boards, and one staggered end-joint per board
    for (let x = 0; x < 16; x++) d.px(x, b * 4 + 3, [118, 92, 54]);
    const joint = 2 + ((b * 5 + 3) % 12);
    for (let y = b * 4; y < b * 4 + 3; y++) d.px(joint, y, [124, 98, 58]);
    // grain and a knot
    for (let k = 0; k < 3; k++) {
      const gx = (rng() * 16) | 0, gy = b * 4 + ((rng() * 3) | 0);
      d.px(gx, gy, [140, 110, 66]); d.px(gx + 1, gy, [146, 116, 70]);
    }
    if (b % 2 === 0) {
      const kx = 4 + ((rng() * 8) | 0), ky = b * 4 + 1;
      d.px(kx, ky, [116, 90, 52]); d.px(kx + 1, ky, [128, 100, 60]);
    }
  }
});
T('water', d => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = noise2(0x6C1, x / 5.5, y / 4.0);
    const q = Math.round((n - 0.5) * 3) / 3;
    const v = q * 26;
    d.px(x, y, [46 + v, 92 + v * 1.2, 196 + v], 205);
  }
  const rng = mulberry32(0x6C2);
  for (let k = 0; k < 10; k++) {
    const x = (rng() * 14) | 0, y = (rng() * 16) | 0;
    d.px(x, y, [104, 150, 226], 215); d.px(x + 1, y, [104, 150, 226], 215);
  }
});
T('glass', d => {
  d.fill([0, 0, 0], 0, 0);
  // a thin pale frame plus two highlight streaks — mostly see-through
  for (let i = 0; i < 16; i++) {
    d.px(i, 0, [214, 232, 236], 170); d.px(i, 15, [214, 232, 236], 170);
    d.px(0, i, [214, 232, 236], 170); d.px(15, i, [214, 232, 236], 170);
  }
  for (let i = 0; i < 5; i++) d.px(3 + i, 2 + i, [255, 255, 255], 120);
  for (let i = 0; i < 3; i++) d.px(10 + i, 9 + i, [255, 255, 255], 90);
  d.px(1, 1, [236, 248, 250], 190); d.px(14, 14, [190, 210, 214], 150);
});
oreTile2('coal_ore', [28, 28, 28], 5, 1809);
oreTile2('iron_ore', [206, 160, 124], 5, 1810);
oreTile2('gold_ore', [250, 220, 70], 5, 1811);
oreTile2('diamond_ore', [92, 232, 222], 5, 1812);
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
T('snow', d => {
  mottle(d, [243, 248, 252], 10, 4.0, 2, 0x701);
  const rng = mulberry32(0x702);
  for (let k = 0; k < 12; k++) d.px((rng() * 16) | 0, (rng() * 16) | 0, [224, 232, 242]);
});
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
T('birch_log', d => {
  mottle(d, [216, 214, 206], 18, 3.0, 3, 1698);
  const rng = mulberry32(1701);
  // vertical grain at irregular intervals
  let x = 0;
  while (x < 16) {
    const w = 1 + ((rng() * 2) | 0);
    for (let y = 0; y < 16; y++) {
      if (rng() < 0.82) for (let i = 0; i < w; i++) {
        const v = (rng() - 0.5) * 10;
        d.px(x + i, y, [92 + v, 94 + v, 88 + v]);
      }
    }
    x += w + 1 + ((rng() * 2) | 0);
  }
});
T('spruce_log', d => {
  mottle(d, [62, 42, 24], 18, 3.0, 3, 1699);
  const rng = mulberry32(1700);
  // vertical grain at irregular intervals
  let x = 0;
  while (x < 16) {
    const w = 1 + ((rng() * 2) | 0);
    for (let y = 0; y < 16; y++) {
      if (rng() < 0.82) for (let i = 0; i < w; i++) {
        const v = (rng() - 0.5) * 10;
        d.px(x + i, y, [40 + v, 26 + v, 14 + v]);
      }
    }
    x += w + 1 + ((rng() * 2) | 0);
  }
});
T('spruce_leaves', d => {
  d.fill([0, 0, 0], 0, 0);
  const rng = mulberry32(1714);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = noise2(1713, x / 2.6, y / 2.6);
    if (n < 0.21) continue;                       // gaps you can see sky through
    const q = Math.round((n - 0.5) * 4) / 4;
    const v = q * 42 + (rng() - 0.5) * 16;
    d.px(x, y, [46 + v, 92 + v, 54 + v]);
  }
  // a few bright leaves catching the light
  for (let k = 0; k < 12; k++) {
    const x = (rng() * 16) | 0, y = (rng() * 16) | 0;
    if (d.get(x, y)[3] > 0) d.px(x, y, [62, 119, 72]);
  }
});
T('dandelion', d => {
  d.fill([0, 0, 0], 0, 0);
  const rng = mulberry32(1841);
  // stem with a couple of leaves
  for (let y = 7; y < 16; y++) d.px(7 + (y > 12 ? 1 : 0), y, [58, 118, 42]);
  d.px(6, 10, [70, 132, 50]); d.px(5, 11, [70, 132, 50]);
  d.px(9, 12, [70, 132, 50]); d.px(10, 13, [70, 132, 50]);
  // the bloom
  const P = [252, 216, 40], C = [255, 244, 140];
  for (const [x, y] of [[6,3],[7,2],[8,3],[5,4],[9,4],[6,5],[8,5],[7,6]]) d.px(x, y, P);
  for (const [x, y] of [[7,3],[7,4],[8,4],[6,4]]) d.px(x, y, C);
  for (let k = 0; k < 3; k++) d.px(5 + ((rng() * 5) | 0), 2 + ((rng() * 4) | 0),
    [Math.min(255, P[0] * 1.2), Math.min(255, P[1] * 1.2), Math.min(255, P[2] * 1.2)]);
});
T('poppy', d => {
  d.fill([0, 0, 0], 0, 0);
  const rng = mulberry32(1842);
  // stem with a couple of leaves
  for (let y = 7; y < 16; y++) d.px(7 + (y > 12 ? 1 : 0), y, [58, 118, 42]);
  d.px(6, 10, [70, 132, 50]); d.px(5, 11, [70, 132, 50]);
  d.px(9, 12, [70, 132, 50]); d.px(10, 13, [70, 132, 50]);
  // the bloom
  const P = [206, 44, 40], C = [40, 26, 20];
  for (const [x, y] of [[6,3],[7,2],[8,3],[5,4],[9,4],[6,5],[8,5],[7,6]]) d.px(x, y, P);
  for (const [x, y] of [[7,3],[7,4],[8,4],[6,4]]) d.px(x, y, C);
  for (let k = 0; k < 3; k++) d.px(5 + ((rng() * 5) | 0), 2 + ((rng() * 4) | 0),
    [Math.min(255, P[0] * 1.2), Math.min(255, P[1] * 1.2), Math.min(255, P[2] * 1.2)]);
});
T('tall_grass', d => {
  d.fill([0, 0, 0], 0, 0);
  const rng = mulberry32(0x721);
  // individual blades, tapering and leaning as they rise
  for (let k = 0; k < 11; k++) {
    let x = 1 + ((rng() * 14) | 0);
    const h = 6 + ((rng() * 9) | 0);
    const lean = rng() < 0.5 ? -1 : 1;
    const tone = 88 + rng() * 44;
    for (let i = 0; i < h; i++) {
      const y = 15 - i;
      if (i > h * 0.62 && rng() < 0.45) x += lean;   // the tip bends over
      d.px(x, y, [tone * 0.62, tone + 42, tone * 0.5]);
      if (i < h * 0.5 && rng() < 0.4) d.px(x + 1, y, [tone * 0.5, tone + 26, tone * 0.42]);
    }
  }
});
T('sapling', d => {
  d.fill([0, 0, 0], 0, 0);
  const rng = mulberry32(0x741);
  for (let y = 9; y < 16; y++) d.px(7, y, [104, 82, 50]);
  d.px(8, 12, [104, 82, 50]);
  // a small crown of leaves
  for (let y = 2; y < 10; y++) for (let x = 3; x < 13; x++) {
    const r = Math.hypot(x - 7.5, y - 6) ;
    if (r > 4.2 || (r > 3 && rng() < 0.55)) continue;
    const v = (rng() - 0.5) * 40;
    d.px(x, y, [62 + v, 122 + v, 46 + v]);
  }
});
T('obsidian', d => { d.fill([24, 18, 38], 8); d.speckle([60, 44, 90], 20, 10); d.speckle([10, 8, 18], 24, 4); });
T('mossy_cobblestone', d => {
  cobbles(d, 12, 126, 58, 68, 0x651);
  const rng = mulberry32(0x652);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (noise2(0x653, x / 3.4, y / 3.4) > 0.58) {
      const v = (rng() - 0.5) * 22;
      d.px(x, y, [86 + v, 118 + v, 58 + v]);
    }
  }
});
T('farmland', d => { d.fill([96, 62, 38], 10); for (const x of [2, 6, 10, 14]) d.rect(x, 0, 1, 16, [70, 44, 26], 5); });
T('wheat_crop', d => {
  d.fill([0, 0, 0], 0, 0);
  const rng = mulberry32(0x751);
  for (const x of [2, 6, 10, 14]) {
    for (let y = 4; y < 16; y++) d.px(x, y, [178, 162, 62]);
    // grains hanging off the stalk
    for (let y = 4; y < 11; y += 2) {
      d.px(x - 1, y, [224, 204, 96]);
      d.px(x + 1, y + 1, [224, 204, 96]);
    }
    d.px(x, 3, [236, 220, 130]);
    if (rng() < 0.5) d.px(x, 2, [236, 220, 130]);
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
  const mortar = [166, 158, 150];
  d.fill(mortar, 6);
  const rng = mulberry32(0x6D1);
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const off = row % 2 ? -4 : 0;
    for (let bx = off; bx < 16; bx += 8) {
      const t = 150 + (rng() - 0.5) * 22;
      for (let yy = y; yy < y + 3; yy++) for (let xx = bx; xx < bx + 7; xx++) {
        if (xx < 0 || xx > 15) continue;
        const v = (rng() - 0.5) * 12;
        d.px(xx, yy, [t + v, t * 0.47 + v, t * 0.40 + v]);
      }
    }
  }
});
T('stone_bricks', d => {
  mottle(d, [124, 124, 124], 18, 4.0, 3, 0x6E1);
  const seam = [86, 86, 86];
  for (let x = 0; x < 16; x++) { d.px(x, 7, seam); d.px(x, 15, seam); }
  for (let y = 0; y < 8; y++) d.px(7, y, seam);
  for (let y = 8; y < 16; y++) { d.px(3, y, seam); d.px(11, y, seam); }
  // one weathered brick, as they always have
  const rng = mulberry32(0x6E2);
  for (let k = 0; k < 6; k++) d.px(9 + ((rng() * 5) | 0), 1 + ((rng() * 5) | 0), [102, 102, 102]);
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

// ---------------- nether & end tiles ----------------
T('netherrack', d => {
  d.fill([110, 38, 38], 14);
  d.speckle([78, 24, 24], 40, 10); d.speckle([140, 56, 52], 26, 10);
  for (let k = 0; k < 5; k++) {
    const x = (d.rng() * 14) | 0, y = (d.rng() * 14) | 0;
    d.rect(x, y, 2, 1, [70, 20, 20], 6);
  }
});
T('soul_sand', d => {
  d.fill([84, 64, 52], 10); d.speckle([62, 46, 36], 30, 8);
  // faces pressed into the sand
  for (const [ox, oy] of [[3, 4], [9, 8]]) {
    d.rect(ox, oy, 4, 4, [58, 44, 34], 5);
    d.px(ox + 1, oy + 1, [38, 28, 22]); d.px(ox + 3, oy + 1, [38, 28, 22]);
    d.rect(ox + 1, oy + 3, 3, 1, [38, 28, 22]);
  }
});
T('glowstone', d => {
  d.fill([132, 100, 48], 12);
  for (let k = 0; k < 16; k++) {
    const x = (d.rng() * 14) | 0, y = (d.rng() * 14) | 0;
    d.rect(x, y, 2, 2, [255, 226, 140], 24);
  }
  d.speckle([255, 248, 200], 18, 6);
});
T('quartz_ore', d => {
  d.fill([110, 38, 38], 14); d.speckle([78, 24, 24], 26, 10);
  for (let k = 0; k < 5; k++) {
    const x = 2 + (d.rng() * 11) | 0, y = 2 + (d.rng() * 11) | 0;
    d.rect(x, y, 2, 2, [235, 230, 222], 12);
    d.px(x + 1, y + 1, [190, 184, 176]);
  }
});
T('nether_bricks', d => {
  d.fill([44, 22, 26], 8);
  for (const y of [0, 8]) d.rect(0, y, 16, 1, [26, 12, 15], 4);
  d.rect(7, 1, 1, 7, [26, 12, 15], 4); d.rect(3, 9, 1, 7, [26, 12, 15], 4); d.rect(11, 9, 1, 7, [26, 12, 15], 4);
  d.speckle([64, 34, 38], 20, 8);
});
T('nether_portal', d => {
  d.fill([120, 40, 190], 26, 210);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const sw = Math.sin(x * 0.9 + y * 0.5) * Math.cos(y * 0.8 - x * 0.3);
    if (sw > 0.35) d.px(x, y, [196, 122, 240], 225);
    else if (sw < -0.55) d.px(x, y, [74, 18, 128], 235);
  }
});
T('end_stone', d => {
  d.fill([220, 222, 168], 10);
  d.speckle([196, 198, 142], 34, 8); d.speckle([240, 242, 196], 20, 6);
});
T('end_frame_top', d => {
  d.fill([88, 100, 84], 8);
  d.rect(3, 3, 10, 10, [58, 68, 56], 6);
});
T('end_frame_top_filled', d => {
  d.fill([88, 100, 84], 8);
  d.rect(3, 3, 10, 10, [30, 34, 30], 4);
  d.rect(4, 4, 8, 8, [86, 200, 176], 22);
  d.px(6, 6, [200, 255, 240]); d.px(9, 9, [40, 120, 108]);
});
T('end_frame_side', d => {
  d.fill([88, 100, 84], 8);
  d.rect(0, 0, 16, 4, [116, 128, 108], 6);
  d.speckle([66, 76, 64], 18, 6);
});
T('end_portal', d => {
  d.fill([6, 4, 16], 4);
  for (let k = 0; k < 26; k++) {
    const x = (d.rng() * 16) | 0, y = (d.rng() * 16) | 0;
    const c = d.rng();
    d.px(x, y, c < 0.5 ? [150, 220, 210] : c < 0.8 ? [110, 90, 200] : [230, 240, 255]);
  }
});
T('dragon_egg', d => {
  d.fill([16, 10, 24], 6);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if ((x + y) % 5 === 0) d.px(x, y, [58, 34, 78], 255);
  }
  d.speckle([120, 80, 160], 12, 10);
});
T('purpur_block', d => {
  d.fill([170, 126, 170], 10);
  d.speckle([150, 104, 152], 30, 8); d.speckle([196, 160, 196], 18, 6);
});

// ---------------- nether & end mob skins ----------------
T('enderman_skin', d => { d.fill([16, 14, 20], 6); d.speckle([28, 24, 34], 16, 6); });
T('enderman_face', d => {
  d.fill([16, 14, 20], 6);
  d.rect(2, 6, 5, 2, [200, 120, 255], 20);
  d.rect(9, 6, 5, 2, [200, 120, 255], 20);
  d.px(3, 6, [245, 220, 255]); d.px(12, 7, [245, 220, 255]);
});
T('ghast_skin', d => { d.fill([226, 226, 226], 8); d.speckle([200, 200, 204], 22, 6); });
T('ghast_face', d => {
  d.fill([226, 226, 226], 8);
  d.rect(2, 5, 4, 3, [40, 40, 40], 4); d.rect(10, 5, 4, 3, [40, 40, 40], 4);
  d.rect(4, 10, 8, 3, [40, 40, 40], 4);
});
T('ghast_face_angry', d => {
  d.fill([226, 226, 226], 8);
  d.rect(2, 5, 4, 3, [220, 40, 40], 10); d.rect(10, 5, 4, 3, [220, 40, 40], 10);
  d.rect(3, 10, 10, 4, [180, 30, 30], 8);
});
T('blaze_skin', d => {
  d.fill([246, 180, 40], 22);
  d.speckle([255, 230, 120], 30, 20); d.speckle([210, 110, 20], 22, 14);
});
T('blaze_face', d => {
  d.fill([246, 180, 40], 18);
  d.rect(3, 5, 3, 3, [70, 50, 10], 6); d.rect(10, 5, 3, 3, [70, 50, 10], 6);
  d.rect(5, 10, 6, 2, [110, 60, 10], 6);
});
T('pigman_skin', d => { d.fill([148, 110, 96], 12); d.speckle([90, 130, 70], 16, 10); });
T('pigman_face', d => {
  d.fill([214, 150, 150], 12);
  d.rect(3, 5, 2, 2, [20, 20, 20]); d.rect(11, 5, 2, 2, [20, 20, 20]);
  d.rect(5, 9, 6, 4, [176, 110, 116], 8);
  d.px(6, 11, [90, 40, 46]); d.px(9, 11, [90, 40, 46]);
  d.speckle([110, 140, 80], 10, 8);
});
T('dragon_skin', d => {
  d.fill([26, 22, 34], 8);
  d.speckle([44, 38, 58], 26, 8);
  for (let y = 0; y < 16; y += 4) d.rect(0, y, 16, 1, [12, 10, 16], 4);
});
T('dragon_face', d => {
  d.fill([26, 22, 34], 8);
  d.rect(2, 4, 5, 3, [210, 60, 210], 24); d.rect(9, 4, 5, 3, [210, 60, 210], 24);
  d.rect(4, 11, 8, 2, [70, 60, 84], 8);
  d.px(3, 5, [255, 200, 255]); d.px(12, 5, [255, 200, 255]);
});
T('dragon_wing', d => {
  d.fill([32, 26, 44], 10);
  for (let y = 0; y < 16; y += 5) d.rect(0, y, 16, 1, [16, 12, 22], 4);
  d.speckle([54, 44, 72], 18, 8);
});
T('crystal', d => {
  d.fill([0, 0, 0], 0, 0);
  for (let y = 1; y < 15; y++) {
    const w = 7 - Math.abs(y - 8) * 0.7;
    for (let x = 8 - w; x <= 8 + w; x++) d.px(x, y, [222, 240, 220], 205);
  }
  d.rect(6, 6, 4, 4, [180, 255, 220], 235);
  d.px(7, 4, [255, 255, 255]); d.px(9, 11, [140, 200, 180]);
});
T('fireball', d => {
  d.fill([0, 0, 0], 0, 0);
  for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
    const dx = x - 8, dy = y - 8, r = Math.hypot(dx, dy);
    if (r < 5.6) d.px(x, y, r < 2.4 ? [255, 246, 190] : r < 4 ? [255, 170, 40] : [220, 90, 20], 245);
  }
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
tiles('netherrack', 'netherrack', 'netherrack', 'netherrack');
tiles('soul_sand', 'soul_sand', 'soul_sand', 'soul_sand');
tiles('glowstone', 'glowstone', 'glowstone', 'glowstone');
tiles('quartz_ore', 'quartz_ore', 'quartz_ore', 'quartz_ore');
tiles('nether_bricks', 'nether_bricks', 'nether_bricks', 'nether_bricks');
tiles('nether_portal', 'nether_portal', 'nether_portal', 'nether_portal');
tiles('end_stone', 'end_stone', 'end_stone', 'end_stone');
tiles('end_portal_frame', 'end_frame_top', 'end_frame_side', 'end_frame_side');
tiles('end_portal_frame_filled', 'end_frame_top_filled', 'end_frame_side', 'end_frame_side');
tiles('end_portal', 'end_portal', 'end_portal', 'end_portal');
tiles('dragon_egg', 'dragon_egg', 'dragon_egg', 'dragon_egg');
tiles('purpur_block', 'purpur_block', 'purpur_block', 'purpur_block');

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

icon('flint_and_steel', d => {
  d.fill([0,0,0],0,0);
  d.pat(['................','.....gggg.......','....g....g......','...g..dd..g.....','..g..d..d..g....','.g..d....d......','....d.....s.....','.........ss.....','........sss.....','.......ss.......'],
    { g: [120, 120, 128], d: [90, 90, 96], s: [150, 110, 60] });
  d.rect(3, 10, 5, 4, [150, 110, 60], 10);
  d.rect(4, 11, 3, 2, [110, 78, 40], 6);
});
icon('glowstone_dust', d => {
  d.fill([0,0,0],0,0);
  for (let k = 0; k < 22; k++) d.px(3 + ((d.rng()*10)|0), 4 + ((d.rng()*9)|0), [255, 232, 150]);
});
icon('nether_quartz', d => {
  d.fill([0,0,0],0,0);
  d.pat(['................','......mm........','.....mmmm.......','....mmmmmm......','...mmmmmmmm.....','...dmmmmmmd.....','....dmmmmd......','.....dddd.......'], { m: [238, 232, 222], d: [176, 168, 158] });
});
icon('blaze_rod', d => {
  d.fill([0,0,0],0,0);
  for (let i = 0; i < 11; i++) { d.px(4 + i, 12 - i, [252, 200, 40]); d.px(5 + i, 12 - i, [220, 150, 20]); }
  d.px(3, 13, [252, 220, 90]); d.px(14, 2, [252, 220, 90]);
});
icon('blaze_powder', d => {
  d.fill([0,0,0],0,0);
  for (let k = 0; k < 22; k++) d.px(3 + ((d.rng()*10)|0), 4 + ((d.rng()*9)|0), d.rng() < 0.5 ? [252, 180, 30] : [230, 120, 20]);
});
icon('ender_pearl', d => {
  d.fill([0,0,0],0,0);
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) {
    const r = Math.hypot(x - 7.5, y - 7.5);
    if (r < 4.6) d.px(x, y, r < 2 ? [180, 250, 230] : [40, 150, 130], 250);
  }
  d.px(5, 5, [225, 255, 245]);
});
icon('eye_of_ender', d => {
  d.fill([0,0,0],0,0);
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) {
    const r = Math.hypot(x - 7.5, y - 7.5);
    if (r < 4.6) d.px(x, y, [30, 130, 110], 250);
  }
  d.rect(6, 5, 3, 6, [240, 245, 230], 8);
  d.rect(7, 7, 1, 2, [20, 20, 20]);
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
