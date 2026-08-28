'use strict';
// ---------------------------------------------------------------- world: chunks, generation, meshing

const CHUNK = 16, WORLD_H = 128, SEA = 44;
let VIEW_R = 6;                 // chunk load radius (reduced on touch devices)
const CKEY = (cx, cz) => cx + ',' + cz;

// Ore veins, roughly four to six times scarcer than the old per-block scatter
// and clustered into pockets, so ore is something you go looking for rather
// than something that studs every wall you walk past.
// n = veins per chunk (fractional means "this often"), size = blocks per vein.
const ORE_VEINS = [
  { id: 'coal_ore',    n: 2.6,  size: 10, min: 10, max: 92 },
  { id: 'iron_ore',    n: 1.5,  size: 7,  min: 5,  max: 58 },
  { id: 'gold_ore',    n: 0.30, size: 5,  min: 4,  max: 30 },
  { id: 'diamond_ore', n: 0.16, size: 4,  min: 2,  max: 15 },
  { id: 'gravel',      n: 1.2,  size: 14, min: 8,  max: 60 },
  { id: 'dirt',        n: 1.0,  size: 12, min: 6,  max: 44 },
].map(v => ({ ...v, id: B[v.id] }));

class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.blocks = new Uint8Array(CHUNK * CHUNK * WORLD_H);
    this.hmax = new Uint8Array(CHUNK * CHUNK); // highest sky-blocking block per column
    this.populated = false;
    this.dirty = true;
    this.mesh = null;     // gl buffers, owned by renderer
    this.meshing = false;
  }
  idx(x, y, z) { return (y * CHUNK + z) * CHUNK + x; }
  get(x, y, z) { return this.blocks[(y * CHUNK + z) * CHUNK + x]; }
  set(x, y, z, id) { this.blocks[(y * CHUNK + z) * CHUNK + x] = id; }
}

function blocksSky(id) {
  if (id === 0) return false;
  const b = Blocks[id];
  return b.opaque || b.rt === RT_WATER;
}

class World {
  constructor(seed, dim = 'overworld') {
    this.seed = seed >>> 0;
    this.dim = dim;
    this.fortressSpots = [];
    this.dragonDead = false;
    this.strongholdBuilt = false;
    this.chunks = new Map();
    this.diffs = {};            // "x,y,z" -> id  (player edits, saved)
    this.furnaces = {};         // "x,y,z" -> {in:[id,n], fuel:[id,n], out:[id,n], burn:0, burnMax:0, prog:0}
    this.chests = {};           // "x,y,z" -> [27 slots]
    this.ticks = [];            // scheduled updates {x,y,z,at}
    this.meshQueue = [];
  }

  // ---------------- biome & height ----------------
  biomeAt(x, z) {
    const s = this.seed;
    const temp = fbm2(s ^ 0xA1, x / 340, z / 340, 3, 2, 0.5);
    const moist = fbm2(s ^ 0xB2, x / 290, z / 290, 3, 2, 0.5);
    const mount = fbm2(s ^ 0xC3, x / 420, z / 420, 4, 2, 0.5);
    if (mount > 0.62) return 'mountains';
    if (temp < 0.36) return 'snow';
    if (temp > 0.62 && moist < 0.42) return 'desert';
    if (moist > 0.54) return 'forest';
    return 'plains';
  }
  heightAt(x, z) {
    const s = this.seed;
    const base = fbm2(s ^ 0x11, x / 180, z / 180, 4, 2, 0.5);       // continents
    const hills = fbm2(s ^ 0x22, x / 46, z / 46, 4, 2, 0.5);        // local relief
    const mount = fbm2(s ^ 0xC3, x / 420, z / 420, 4, 2, 0.5);      // mountain mask
    const ridge = 1 - Math.abs(2 * fbm2(s ^ 0x33, x / 90, z / 90, 4, 2, 0.5) - 1);
    let h = 34 + base * 26 + (hills - 0.5) * 14;
    const mf = clamp((mount - 0.55) / 0.2, 0, 1);
    h += mf * ridge * 46;
    return Math.floor(clamp(h, 4, WORLD_H - 10));
  }
  caveAt(x, y, z) {
    if (y <= 2) return false;
    const s = this.seed;
    const n1 = noise3(s ^ 0x44, x / 24, y / 16, z / 24);
    const n2 = noise3(s ^ 0x55, x / 24 + 100, y / 16, z / 24 + 100);
    const worm = (1 - Math.abs(2 * n1 - 1)) * (1 - Math.abs(2 * n2 - 1));
    const room = noise3(s ^ 0x66, x / 34, y / 22, z / 34);
    return worm > 0.82 || room > 0.78;
  }

  // ---------------- generation ----------------
  baseChunk(cx, cz) {
    const key = CKEY(cx, cz);
    let c = this.chunks.get(key);
    if (c) return c;
    c = new Chunk(cx, cz);
    this.chunks.set(key, c);
    if (this.dim === 'nether') { genNether(this, c, cx, cz); this.computeHeightmap(c); return c; }
    if (this.dim === 'end') { genEnd(this, c, cx, cz); this.computeHeightmap(c); return c; }
    const s = this.seed;
    for (let lx = 0; lx < CHUNK; lx++) for (let lz = 0; lz < CHUNK; lz++) {
      const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz;
      const h = this.heightAt(wx, wz);
      const biome = this.biomeAt(wx, wz);
      for (let y = 0; y <= Math.max(h, SEA); y++) {
        let id = 0;
        if (y > h) { id = y <= SEA ? B.water : 0; }
        else if (y === 0) id = B.bedrock;
        else if (y <= 2 && hash3(s, wx, y, wz) < 0.5) id = B.bedrock;
        else if (this.caveAt(wx, y, wz) && y > 4 && !(y >= h - 1 && h <= SEA + 1)) {
          id = y < 11 ? B.lava : 0;
        }
        else if (y === h) {
          if (biome === 'desert') id = B.sand;
          else if (biome === 'snow') id = h <= SEA + 1 ? B.dirt : B.snowy_grass;
          else if (h < SEA + 2) id = B.sand;
          else id = B.grass_block;
        }
        else if (y > h - 4) {
          id = (biome === 'desert') ? (y > h - 3 ? B.sand : B.sandstone) : B.dirt;
        }
        else id = B.stone;
        if (id) c.set(lx, y, lz, id);
      }
      // freeze water surface in snow biome
      if (biome === 'snow' && c.get(lx, SEA, lz) === B.water) c.set(lx, SEA, lz, B.ice);
    }
    this.placeVeins(c, cx, cz);
    this.computeHeightmap(c);
    return c;
  }

  // ---------------- ore veins ----------------
  // Veins are seeded per chunk but spill over the edges, so a chunk also runs
  // its eight neighbours' veins and keeps whatever lands inside it. The RNG
  // stream depends only on the source chunk, so both sides agree on the shape.
  placeVeins(c, cx, cz) {
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) this.veinsFrom(c, cx, cz, cx + dx, cz + dz);
  }
  veinsFrom(c, cx, cz, ox, oz) {
    const rng = mulberry32((this.seed ^ 0x51ED9) + ox * 341873128 + oz * 132897987);
    const bx = (ox - cx) * CHUNK, bz = (oz - cz) * CHUNK;
    for (const v of ORE_VEINS) {
      let count = Math.floor(v.n);
      if (rng() < v.n - count) count++;
      for (let i = 0; i < count; i++) {
        const vx = bx + rng() * CHUNK, vz = bz + rng() * CHUNK;
        const vy = v.min + rng() * (v.max - v.min);
        this.carveVein(c, vx, vy, vz, v.size, v.id, rng);
      }
    }
  }
  carveVein(c, x, y, z, size, id, rng) {
    // a short random walk dropping a blob at each step, the way a real pocket
    // of ore snakes through the rock rather than sitting in a neat ball
    let px = x, py = y, pz = z, placed = 0;
    const steps = Math.max(1, Math.round(size / 2.2));
    for (let s = 0; s < steps && placed < size; s++) {
      const r = 0.8 + rng() * 0.9, ri = Math.ceil(r), lim = r * r + 0.35;
      const cxi = Math.round(px), cyi = Math.round(py), czi = Math.round(pz);
      for (let dy = -ri; dy <= ri && placed < size; dy++)
        for (let dz = -ri; dz <= ri && placed < size; dz++)
          for (let dx = -ri; dx <= ri && placed < size; dx++) {
            if (dx * dx + dy * dy + dz * dz > lim) continue;
            const gx = cxi + dx, gy = cyi + dy, gz = czi + dz;
            if (gx < 0 || gz < 0 || gx >= CHUNK || gz >= CHUNK || gy < 1 || gy >= WORLD_H) continue;
            if (c.get(gx, gy, gz) !== B.stone) continue;   // never float in a cave
            c.set(gx, gy, gz, id);
            placed++;
          }
      px += rng() * 2.6 - 1.3; py += rng() * 2.0 - 1.0; pz += rng() * 2.6 - 1.3;
    }
  }

  computeHeightmap(c) {
    for (let lx = 0; lx < CHUNK; lx++) for (let lz = 0; lz < CHUNK; lz++) {
      let y = WORLD_H - 1;
      while (y > 0 && !blocksSky(c.get(lx, y, lz))) y--;
      c.hmax[lz * CHUNK + lx] = y;
    }
  }

  populate(cx, cz) {
    const c = this.chunks.get(CKEY(cx, cz));
    if (!c || c.populated) return;
    // ensure ring of base chunks so features can cross borders
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) this.baseChunk(cx + dx, cz + dz);
    c.populated = true;
    if (this.dim === 'nether') { popNether(this, c, cx, cz); c.dirty = true; return; }
    if (this.dim === 'end') { popEnd(this, c, cx, cz); c.dirty = true; return; }
    popStronghold(this, c, cx, cz);
    const rng = mulberry32(this.seed ^ Math.imul(cx, 341873128) ^ Math.imul(cz, 132897987));
    const setg = (x, y, z, id, soft) => {
      if (y < 1 || y >= WORLD_H) return;
      const cur = this.getBlock(x, y, z);
      if (soft && cur !== 0) return;
      this.setBlockRaw(x, y, z, id);
    };
    for (let lx = 0; lx < CHUNK; lx++) for (let lz = 0; lz < CHUNK; lz++) {
      const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz;
      const h = this.heightAt(wx, wz);
      if (h <= SEA) continue;
      const biome = this.biomeAt(wx, wz);
      const ground = this.getBlock(wx, h, wz);
      const r = rng();
      if (biome === 'forest' && r < 0.022 && ground === B.grass_block) {
        this.tree(wx, h + 1, wz, rng() < 0.2 ? 'birch' : 'oak', rng, setg);
      } else if (biome === 'plains' && r < 0.003 && ground === B.grass_block) {
        this.tree(wx, h + 1, wz, 'oak', rng, setg);
      } else if (biome === 'snow' && r < 0.012 && ground === B.snowy_grass) {
        this.tree(wx, h + 1, wz, 'spruce', rng, setg);
      } else if (biome === 'mountains' && r < 0.004 && (ground === B.grass_block || ground === B.snowy_grass)) {
        this.tree(wx, h + 1, wz, 'spruce', rng, setg);
      } else if (biome === 'desert' && r < 0.005 && ground === B.sand) {
        const ch = 2 + (rng() * 2 | 0);
        for (let i = 1; i <= ch; i++) setg(wx, h + i, wz, B.cactus, true);
      } else if (r >= 0.022 && r < 0.14 && (ground === B.grass_block)) {
        if (r < 0.10) setg(wx, h + 1, wz, B.tall_grass, true);
        else if (r < 0.115) setg(wx, h + 1, wz, rng() < 0.5 ? B.dandelion : B.poppy, true);
        else if (r < 0.118 && biome === 'plains') setg(wx, h + 1, wz, B.pumpkin, true);
      } else if (r >= 0.14 && r < 0.143 && biome === 'forest' && ground === B.grass_block) {
        setg(wx, h + 1, wz, rng() < 0.5 ? B.red_mushroom : B.brown_mushroom, true);
      }
    }
    // rare buried dungeon with a loot chest
    const drng = mulberry32(this.seed ^ 0xD00D ^ Math.imul(cx, 668265263) ^ Math.imul(cz, 374761393));
    if (drng() < 0.03) {
      const dx0 = cx * CHUNK + 4, dz0 = cz * CHUNK + 4;
      const dy = 14 + (drng() * 16 | 0);
      const W = 7, H = 4, D = 7;
      for (let x = -1; x <= W; x++) for (let y = -1; y <= H; y++) for (let z = -1; z <= D; z++) {
        const wx = dx0 + x, wy = dy + y, wz = dz0 + z;
        const edge = x === -1 || y === -1 || z === -1 || x === W || y === H || z === D;
        if (edge) {
          if (this.getBlock(wx, wy, wz) !== 0)
            this.setBlockRaw(wx, wy, wz, drng() < 0.35 ? B.mossy_cobblestone : B.cobblestone);
        } else this.setBlockRaw(wx, wy, wz, 0);
      }
      const chestX = dx0 + 3, chestZ = dz0 + 3;
      this.setBlockRaw(chestX, dy, chestZ, B.chest);
      const key = chestX + ',' + dy + ',' + chestZ;
      if (!this.chests[key]) {
        const slots = new Array(27).fill(null);
        const loot = [
          [I.bread, 1, 3, 0.7], [I.iron_ingot, 1, 4, 0.6], [I.gold_ingot, 1, 3, 0.35],
          [I.diamond, 1, 2, 0.15], [I.string, 1, 4, 0.5], [I.apple, 1, 2, 0.5],
          [B.torch, 2, 6, 0.6], [I.arrow, 2, 8, 0.45], [I.bone, 1, 3, 0.4],
        ];
        for (const [id, a, b2, ch] of loot)
          if (drng() < ch) slots[(drng() * 27) | 0] = { id, count: a + (drng() * (b2 - a + 1) | 0) };
        this.chests[key] = slots;
      }
      this.setBlockRaw(dx0 + 1, dy, dz0 + 1, B.torch);
    }
    c.dirty = true;
  }

  tree(x, y, z, kind, rng, setg) {
    const log = kind === 'birch' ? B.birch_log : kind === 'spruce' ? B.spruce_log : B.oak_log;
    const leaf = kind === 'spruce' ? B.spruce_leaves : B.oak_leaves;
    const h = kind === 'spruce' ? 6 + (rng() * 3 | 0) : 4 + (rng() * 3 | 0);
    for (let i = 0; i < h; i++) setg(x, y + i, z, log);
    if (kind === 'spruce') {
      for (let ly = 2; ly <= h; ly++) {
        const r = ly === h ? 0 : Math.max(1, Math.round((h - ly) / 2.2));
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > r + (ly % 2 ? 0 : 1)) continue;
          setg(x + dx, y + ly, z + dz, leaf, true);
        }
      }
      setg(x, y + h, z, leaf, true);
    } else {
      for (let ly = h - 3; ly <= h + 1; ly++) {
        const r = ly > h - 1 ? 1 : 2;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && rng() < 0.5) continue;
          if (ly === h + 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
          setg(x + dx, y + ly, z + dz, leaf, true);
        }
      }
    }
  }

  // ---------------- access ----------------
  chunkAt(x, z) { return this.chunks.get(CKEY(Math.floor(x / CHUNK), Math.floor(z / CHUNK))); }
  getBlock(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0 || y >= WORLD_H) return 0;
    const c = this.chunks.get(CKEY(x >> 4, z >> 4));
    if (!c) return 0;
    return c.get(x & 15, y, z & 15);
  }
  // raw set: no diff recording (world gen)
  setBlockRaw(x, y, z, id) {
    if (y < 0 || y >= WORLD_H) return;
    const c = this.baseChunk(x >> 4, z >> 4);
    const old = c.get(x & 15, y, z & 15);
    c.set(x & 15, y, z & 15, id);
    // light emitters influence meshes up to 14 blocks away — remesh the 3x3 ring
    if (EMIT[id] || EMIT[old]) {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const cc = this.chunks.get(CKEY((x >> 4) + dx, (z >> 4) + dz));
        if (cc) cc.dirty = true;
      }
    }
    const ci = (z & 15) * CHUNK + (x & 15);
    if (blocksSky(id) && y > c.hmax[ci]) c.hmax[ci] = y;
    else if (!blocksSky(id) && y === c.hmax[ci]) {
      let yy = y;
      while (yy > 0 && !blocksSky(c.get(x & 15, yy, z & 15))) yy--;
      c.hmax[ci] = yy;
    }
    c.dirty = true;
    if ((x & 15) === 0) this.dirtyAt(x - 1, z); if ((x & 15) === 15) this.dirtyAt(x + 1, z);
    if ((z & 15) === 0) this.dirtyAt(x, z - 1); if ((z & 15) === 15) this.dirtyAt(x, z + 1);
  }
  dirtyAt(x, z) { const c = this.chunks.get(CKEY(x >> 4, z >> 4)); if (c) c.dirty = true; }

  // player edit: records diff, schedules neighbor ticks
  setBlock(x, y, z, id) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    const old = this.getBlock(x, y, z);
    if (old === id) return;
    this.setBlockRaw(x, y, z, id);
    this.diffs[x + ',' + y + ',' + z] = id;
    // schedule block updates around the change
    const now = performance.now();
    for (const [dx, dy, dz] of [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,0,0]])
      this.ticks.push({ x: x + dx, y: y + dy, z: z + dz, at: now + 120 + Math.random() * 150 });
    if (old === B.furnace || old === B.furnace_lit) delete this.furnaces[x + ',' + y + ',' + z];
  }

  // ---------------- scheduled block updates ----------------
  runTicks(game) {
    const now = performance.now();
    let n = 0;
    for (let i = this.ticks.length - 1; i >= 0 && n < 64; i--) {
      const t = this.ticks[i];
      if (t.at > now) continue;
      this.ticks.splice(i, 1); n++;
      this.updateBlock(t.x, t.y, t.z, game);
    }
    if (this.ticks.length > 4000) this.ticks.splice(0, this.ticks.length - 4000);
  }
  updateBlock(x, y, z, game) {
    const id = this.getBlock(x, y, z);
    if (!id) return;
    const below = this.getBlock(x, y - 1, z);
    if (Blocks[id].gravity && (below === 0 || below === B.water || below === B.lava)) {
      // falling sand/gravel
      this.setBlock(x, y, z, 0);
      let yy = y - 1;
      while (yy > 0) {
        const b = this.getBlock(x, yy - 1, z);
        if (b === 0 || b === B.water || b === B.lava) yy--; else break;
      }
      this.setBlock(x, yy, z, id);
      return;
    }
    // plants need support
    const b = Blocks[id];
    if ((b.rt === RT_CROSS || id === B.cactus) && below === 0) {
      this.breakBlockNatural(x, y, z, game);
      return;
    }
    // torch on air
    if (id === B.torch && below === 0) { this.breakBlockNatural(x, y, z, game); return; }
    // water falls into air below
    if (id === B.water && this.getBlock(x, y - 1, z) === 0) {
      this.setBlock(x, y - 1, z, B.water);
    }
    // water + lava -> obsidian / stone
    if (id === B.water || id === B.lava) {
      for (const [dx, dy, dz] of [[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0]]) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const nid = this.getBlock(nx, ny, nz);
        if ((id === B.water && nid === B.lava)) {
          this.setBlock(nx, ny, nz, dy < 0 ? B.obsidian : B.stone);
          if (game) game.particles.burst(nx + 0.5, ny + 1, nz + 0.5, TileIdx.stone, 6, 2);
        } else if (id === B.lava && nid === B.water) {
          this.setBlock(x, y, z, B.obsidian);
          if (game) game.particles.burst(x + 0.5, y + 1, z + 0.5, TileIdx.stone, 6, 2);
          return;
        }
      }
    }
  }
  breakBlockNatural(x, y, z, game) {
    const id = this.getBlock(x, y, z);
    if (!id) return;
    this.setBlock(x, y, z, 0);
    const d = blockDrops(id, 0);
    if (d && game) game.spawnDrop(x + 0.5, y + 0.3, z + 0.5, d[0], d[1]);
  }

  // sky light at cell (0..1); leaves don't block
  skyAt(x, y, z) {
    if (this.dim === 'nether') return 0.55;
    if (this.dim === 'end') return 0.72;
    const c = this.chunks.get(CKEY(x >> 4, z >> 4));
    if (!c) return 1;
    const hm = c.hmax[(z & 15) * CHUNK + (x & 15)];
    if (y >= hm) return 1;
    return Math.max(0.18, 1 - (hm - y) * 0.10);
  }

  // ---------------- raycast (DDA) ----------------
  raycast(ox, oy, oz, dx, dy, dz, maxDist, hitFluid = false) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = (dx > 0 ? (x + 1 - ox) : (ox - x)) * tdx;
    let ty = (dy > 0 ? (y + 1 - oy) : (oy - y)) * tdy;
    let tz = (dz > 0 ? (z + 1 - oz) : (oz - z)) * tdz;
    let face = [0, 0, 0], t = 0;
    while (t <= maxDist) {
      const id = this.getBlock(x, y, z);
      if (id !== 0 && id !== B.water || (hitFluid && id === B.water)) {
        const b = Blocks[id];
        if (b.solid || b.rt === RT_CROSS || b.rt === RT_TORCH || (hitFluid && id === B.water))
          return { x, y, z, id, face, dist: t };
      }
      if (tx < ty && tx < tz) { x += stepX; t = tx; tx += tdx; face = [-stepX, 0, 0]; }
      else if (ty < tz) { y += stepY; t = ty; ty += tdy; face = [0, -stepY, 0]; }
      else { z += stepZ; t = tz; tz += tdz; face = [0, 0, -stepZ]; }
    }
    return null;
  }

  // ---------------- collisions ----------------
  boxCollides(minx, miny, minz, maxx, maxy, maxz) {
    const x0 = Math.floor(minx), x1 = Math.floor(maxx);
    const y0 = Math.floor(Math.max(0, miny)), y1 = Math.floor(Math.min(WORLD_H - 1, maxy));
    const z0 = Math.floor(minz), z1 = Math.floor(maxz);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const id = this.getBlock(x, y, z);
      if (id && Blocks[id].solid) {
        const bh = Blocks[id].height || 1;
        if (miny < y + bh && maxy > y) return true;
      }
    }
    return false;
  }

  // ---------------- save / load ----------------
  strongholdPos() {
    if (!this._sh) this._sh = strongholdPos(this.seed);
    return this._sh;
  }
  dump() {
    return { diffs: this.diffs, furnaces: this.furnaces, chests: this.chests,
             dragonDead: this.dragonDead, strongholdBuilt: this.strongholdBuilt };
  }
  restore(d) {
    if (!d) return;
    this.diffs = d.diffs || {};
    this.furnaces = d.furnaces || {};
    this.chests = d.chests || {};
    this.dragonDead = !!d.dragonDead;
    this.strongholdBuilt = !!d.strongholdBuilt;
  }
  applyDiffsToChunk(c) {
    // called after populate; diffs already applied via setBlockRaw path on load
  }
  loadDiffs(diffs) {
    this.diffs = diffs || {};
  }
  applySavedDiffs(cx, cz) {
    // apply any diffs that fall inside chunk (after populate)
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    for (const k in this.diffs) {
      const [x, y, z] = k.split(',').map(Number);
      if (x >= x0 && x < x0 + CHUNK && z >= z0 && z < z0 + CHUNK)
        this.setBlockRaw(x, y, z, this.diffs[k]);
    }
  }
  ensureChunk(cx, cz) {
    const key = CKEY(cx, cz);
    let c = this.chunks.get(key);
    if (!c || !c.populated) {
      this.baseChunk(cx, cz);
      this.populate(cx, cz);
      c = this.chunks.get(key);
      this.applySavedDiffs(cx, cz);
      this.computeHeightmap(c);
    }
    return c;
  }
}

// ---------------------------------------------------------------- block light (BFS, baked into meshes)
const LPAD = 14, LW = CHUNK + LPAD * 2;
const EMIT = new Uint8Array(256);        // block id -> light emission level (0-15)
EMIT[B.torch] = 14; EMIT[B.lava] = 15; EMIT[B.furnace_lit] = 13;
const _lightBuf = new Uint8Array(LW * LW * WORLD_H);
const _skyBuf = new Uint8Array(LW * LW * WORLD_H);
const BFS_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// Daylight reaching each cell. Columns open to the sky are full brightness, and
// that light then spreads sideways into overhangs and cave mouths one level per
// block — so a tunnel entrance stays bright and only fades as you go deeper,
// instead of every roofed cell dropping straight to black.
let _skyTop = WORLD_H;      // everything above this is open daylight

// the 3x3 chunk neighbourhood, indexed arithmetically so the light passes
// never touch the chunk map in their inner loops
function neighborGrid(world, cx0, cz0) {
  const grid = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
    grid.push(world.chunks.get(CKEY(cx0 + dx, cz0 + dz)) || null);
  return grid;
}

function computeSkyLight(world, cx0, cz0, grid, blockAt) {
  const x0 = cx0 * CHUNK - LPAD, z0 = cz0 * CHUNK - LPAD;
  // dimensions with no sky of their own skip the whole pass
  if (world.dim !== 'overworld') { _skyTop = 0; return; }
  const q = [];
  let maxO = 0;
  const opens = new Int16Array(LW * LW);
  for (let px = 0; px < LW; px++) for (let pz = 0; pz < LW; pz++) {
    const wx = x0 + px, wz = z0 + pz;
    const gx = (wx >> 4) - cx0 + 1, gz = (wz >> 4) - cz0 + 1;
    const ch = (gx < 0 || gx > 2 || gz < 0 || gz > 2) ? null : grid[gz * 3 + gx];
    // unloaded neighbours count as open sky, which errs bright at the rim
    const o = ch ? ch.hmax[(wz & 15) * CHUNK + (wx & 15)] + 1 : 0;
    opens[pz * LW + px] = o;
    if (o > maxO) maxO = o;
  }
  _skyTop = Math.min(WORLD_H, maxO + 2);
  _skyBuf.fill(0, 0, _skyTop * LW * LW);
  for (let px = 0; px < LW; px++) for (let pz = 0; pz < LW; pz++) {
    const o = opens[pz * LW + px];
    for (let y = o; y < _skyTop; y++) _skyBuf[(y * LW + pz) * LW + px] = 15;
  }
  // seed where daylight touches enclosed space
  for (let y = 0; y < _skyTop; y++) for (let pz = 1; pz < LW - 1; pz++) {
    const row = (y * LW + pz) * LW;
    for (let px = 1; px < LW - 1; px++) {
      const idx = row + px;
      if (_skyBuf[idx] !== 15) continue;
      if (_skyBuf[idx - 1] === 15 && _skyBuf[idx + 1] === 15 &&
          _skyBuf[idx - LW] === 15 && _skyBuf[idx + LW] === 15 &&
          (y === 0 || _skyBuf[idx - LW * LW] === 15)) continue;
      q.push(idx);
    }
  }
  let qi = 0;
  while (qi < q.length) {
    const idx = q[qi++];
    const lvl = _skyBuf[idx];
    if (lvl <= 1) continue;
    const px = idx % LW, t = (idx / LW) | 0, pz = t % LW, y = (t / LW) | 0;
    for (const d of BFS_DIRS) {
      const nx = px + d[0], ny = y + d[1], nz = pz + d[2];
      if (nx < 1 || nx >= LW - 1 || nz < 1 || nz >= LW - 1 || ny < 0 || ny >= _skyTop) continue;
      const nidx = (ny * LW + nz) * LW + nx;
      const nl = lvl - 1;
      if (_skyBuf[nidx] >= nl) continue;
      const id = blockAt(x0 + nx, ny, z0 + nz);
      if (id && Blocks[id].opaque) continue;
      _skyBuf[nidx] = nl;
      q.push(nidx);
    }
  }
}

function computeBlockLight(world, cx0, cz0) {
  _lightBuf.fill(0);
  const x0 = cx0 * CHUNK, z0 = cz0 * CHUNK;
  const grid = neighborGrid(world, cx0, cz0);
  const blockAt = (wx, y, wz) => {
    if (y < 0 || y >= WORLD_H) return 0;
    const gx = (wx >> 4) - cx0 + 1, gz = (wz >> 4) - cz0 + 1;
    if (gx < 0 || gx > 2 || gz < 0 || gz > 2) return 0;
    const ch = grid[gz * 3 + gx];
    return ch ? ch.blocks[(y * CHUNK + (wz & 15)) * CHUNK + (wx & 15)] : 0;
  };
  computeSkyLight(world, cx0, cz0, grid, blockAt);
  const q = [];
  for (let g = 0; g < 9; g++) {
    const ch = grid[g];
    if (!ch) continue;
    const bx = ch.cx * CHUNK - x0 + LPAD, bz = ch.cz * CHUNK - z0 + LPAD;
    const bl = ch.blocks;
    for (let i = 0; i < bl.length; i++) {
      const e = EMIT[bl[i]];
      if (!e) continue;
      const px = bx + (i & 15), pz = bz + ((i >> 4) & 15);
      if (px < 0 || px >= LW || pz < 0 || pz >= LW) continue;
      const idx = ((i >> 8) * LW + pz) * LW + px;
      if (_lightBuf[idx] < e) { _lightBuf[idx] = e; q.push(idx); }
    }
  }
  let qi = 0;
  while (qi < q.length) {
    const idx = q[qi++];
    const lvl = _lightBuf[idx];
    if (lvl <= 1) continue;
    const px = idx % LW, t = (idx / LW) | 0, pz = t % LW, y = (t / LW) | 0;
    for (const d of BFS_DIRS) {
      const nx = px + d[0], ny = y + d[1], nz = pz + d[2];
      if (nx < 0 || nx >= LW || nz < 0 || nz >= LW || ny < 0 || ny >= WORLD_H) continue;
      const nidx = (ny * LW + nz) * LW + nx;
      const nl = lvl - 1;
      if (_lightBuf[nidx] >= nl) continue;
      const id = blockAt(x0 - LPAD + nx, ny, z0 - LPAD + nz);
      if (id && Blocks[id].opaque) continue;
      _lightBuf[nidx] = nl;
      q.push(nidx);
    }
  }
}

// ---------------------------------------------------------------- meshing
// vertex: x,y,z, u,v, skyLight, blockLight  (7 floats)
const FACES = [
  // dir, corners (4, CCW from outside), shade
  { d: [0, 1, 0],  c: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], shade: 1.0 },   // top
  { d: [0, -1, 0], c: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], shade: 0.55 },  // bottom
  { d: [1, 0, 0],  c: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], shade: 0.78 },  // +x
  { d: [-1, 0, 0], c: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], shade: 0.78 },  // -x
  { d: [0, 0, 1],  c: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], shade: 0.68 },  // +z
  { d: [0, 0, -1], c: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], shade: 0.68 },  // -z
];
const UVQ = [[0, 1], [1, 1], [1, 0], [0, 0]]; // matches corner order per face

function tileUVc(ti, u, v) {
  const [tx, ty] = tileXY(ti);
  // half-texel inset avoids atlas bleeding
  const e = 0.35 / ATLAS_PX;
  return [(tx + u * TILE) / ATLAS_PX + (u ? -e : e), (ty + v * TILE) / ATLAS_PX + (v ? -e : e)];
}

function meshChunk(world, c) {
  const solid = [], water = [];
  const x0 = c.cx * CHUNK, z0 = c.cz * CHUNK;
  const get = (x, y, z) => {
    if (y < 0 || y >= WORLD_H) return 0;
    if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK) return c.get(x, y, z);
    return world.getBlock(x0 + x, y, z0 + z);
  };
  const opaqueAt = (x, y, z) => { const id = get(x, y, z); return id !== 0 && Blocks[id].opaque; };
  computeBlockLight(world, c.cx, c.cz);
  const constSky = world.dim !== 'overworld' ? world.skyAt(0, 0, 0) : 0;
  const skyOf = (lx, y, lz) => {
    if (constSky) return constSky;
    if (y >= _skyTop) return 1;
    if (y < 0) y = 0;
    return _skyBuf[(y * LW + lz + LPAD) * LW + lx + LPAD] / 15;
  };
  const blOf = (lx, y, lz) => {
    if (y < 0) y = 0; else if (y >= WORLD_H) y = WORLD_H - 1;
    return _lightBuf[(y * LW + lz + LPAD) * LW + lx + LPAD] / 15;
  };

  for (let y = 0; y < WORLD_H; y++) for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) {
    const id = c.get(lx, y, lz);
    if (!id) continue;
    const b = Blocks[id];
    const wx = x0 + lx, wz = z0 + lz;

    if (b.rt === RT_CROSS || b.rt === RT_TORCH) {
      const ti = b.tiles.side;
      const s = b.rt === RT_TORCH ? 0.5 : 1;
      const off = b.rt === RT_TORCH ? 0.25 : 0;
      const l = skyOf(lx, y, lz);
      const cbl = blOf(lx, y, lz);
      const quads = [
        [[off, 0, off], [1 - off, 0, 1 - off], [1 - off, s, 1 - off], [off, s, off]],
        [[1 - off, 0, off], [off, 0, 1 - off], [off, s, 1 - off], [1 - off, s, off]],
      ];
      for (const q of quads) for (const wind of [0, 1]) {
        const order = wind ? [0, 1, 2, 3] : [3, 2, 1, 0];
        const uvs = wind ? UVQ : [UVQ[3], UVQ[2], UVQ[1], UVQ[0]];
        const vtx = [];
        for (let i = 0; i < 4; i++) {
          const p = q[order[i]];
          const [u, v] = tileUVc(ti, uvs[i][0], uvs[i][1]);
          vtx.push([lx + p[0], y + p[1], lz + p[2], u, v, l * 0.95, cbl]);
        }
        pushQuad(solid, vtx);
      }
      continue;
    }

    if (b.rt === RT_WATER) {
      const above = get(lx, y + 1, lz);
      const topY = (above === id) ? 1 : 0.875;
      const l = Math.max(0.35, skyOf(lx, y, lz));
      const cbl = blOf(lx, y, lz);
      const arr = water;
      // top
      if (above !== id) {
        const f = FACES[0];
        emitFace(arr, lx, y, lz, f, b.tiles.top, l, cbl, topY, id === B.lava);
      }
      // sides against air
      for (let fi = 2; fi < 6; fi++) {
        const f = FACES[fi];
        const n = get(lx + f.d[0], y + f.d[1], lz + f.d[2]);
        if (n === 0) emitFace(arr, lx, y, lz, f, b.tiles.side, l * f.shade, cbl * f.shade, topY, id === B.lava);
      }
      if (get(lx, y - 1, lz) === 0) emitFace(arr, lx, y, lz, FACES[1], b.tiles.side, l * 0.55, cbl * 0.55, topY, id === B.lava);
      continue;
    }

    if (b.rt === RT_HALF) {
      // half-height block (bed): scale the cube vertically
      const hh = b.height || 0.5;
      const l = skyOf(lx, y, lz);
      const hbl = blOf(lx, y, lz);
      for (let fi = 0; fi < 6; fi++) {
        const f = FACES[fi];
        const nid = get(lx + f.d[0], y + f.d[1], lz + f.d[2]);
        if (fi !== 0 && nid && Blocks[nid].opaque) continue;
        let ti = fi === 0 ? b.tiles.top : fi === 1 ? b.tiles.bottom : b.tiles.side;
        const vtx = [];
        for (let i = 0; i < 4; i++) {
          const p = f.c[i];
          const py = p[1] === 1 ? hh : 0;
          const [u, v] = tileUVc(ti, UVQ[i][0], fi >= 2 ? (p[1] === 1 ? 1 - hh : 1) : UVQ[i][1]);
          vtx.push([lx + p[0], y + py, lz + p[2], u, v, Math.max(0.05, l * f.shade), hbl * f.shade]);
        }
        pushQuad(solid, vtx);
      }
      continue;
    }

    // solid / leaves / glass / cactus
    const inset = b.rt === RT_CACTUS ? 1 / 16 : 0;
    for (let fi = 0; fi < 6; fi++) {
      const f = FACES[fi];
      const nx = lx + f.d[0], ny = y + f.d[1], nz = lz + f.d[2];
      const nid = get(nx, ny, nz);
      let show;
      if (b.opaque) show = !nid || !Blocks[nid].opaque;
      else show = nid !== id && (!nid || !Blocks[nid].opaque); // glass/leaves: hide against same id or opaque
      if (!show) continue;
      let ti = fi === 0 ? b.tiles.top : fi === 1 ? b.tiles.bottom : b.tiles.side;
      if (b.tiles.front !== b.tiles.side && fi === 4) ti = b.tiles.front;
      // light from the cell the face opens into
      const sky = ny >= WORLD_H ? 1 : skyOf(nx, ny, nz);
      const baseL = Math.max(0.04, sky) * f.shade * (Blocks[id].light ? 1.4 : 1);
      const nbl = blOf(nx, ny, nz) * f.shade;
      emitSolidFace(solid, get, lx, y, lz, f, fi, ti, baseL, nbl, inset);
    }
  }
  return {
    solid: new Float32Array(solid),
    water: new Float32Array(water),
  };
}

function pushQuad(arr, v) {
  // two triangles: 0,1,2  0,2,3
  for (const i of [0, 1, 2, 0, 2, 3]) arr.push(...v[i]);
}

function emitFace(arr, lx, y, lz, f, ti, light, bl, topY, isLava) {
  const vtx = [];
  for (let i = 0; i < 4; i++) {
    const p = f.c[i];
    const py = p[1] === 1 ? topY : 0;
    const [u, v] = tileUVc(ti, UVQ[i][0], UVQ[i][1]);
    vtx.push([lx + p[0], y + py, lz + p[2], u, v, isLava ? 1.3 : light, isLava ? 1 : bl]);
  }
  pushQuad(arr, vtx);
}

// ambient occlusion: for each corner, check the two side cells + corner cell
function vertexAO(get, x, y, z, f, corner) {
  const d = f.d;
  // outward cell
  const ox = x + d[0], oy = y + d[1], oz = z + d[2];
  // tangent axes for this face
  let t1, t2;
  if (d[1] !== 0) { t1 = [1, 0, 0]; t2 = [0, 0, 1]; }
  else if (d[0] !== 0) { t1 = [0, 1, 0]; t2 = [0, 0, 1]; }
  else { t1 = [1, 0, 0]; t2 = [0, 1, 0]; }
  const s1 = corner[axisIndex(t1)] === 1 ? 1 : -1;
  const s2 = corner[axisIndex(t2)] === 1 ? 1 : -1;
  const a = solidAt(get, ox + t1[0] * s1, oy + t1[1] * s1, oz + t1[2] * s1);
  const b2 = solidAt(get, ox + t2[0] * s2, oy + t2[1] * s2, oz + t2[2] * s2);
  const cc = solidAt(get, ox + t1[0] * s1 + t2[0] * s2, oy + t1[1] * s1 + t2[1] * s2, oz + t1[2] * s1 + t2[2] * s2);
  let occ = 0;
  if (a && b2) occ = 3; else occ = (a ? 1 : 0) + (b2 ? 1 : 0) + (cc ? 1 : 0);
  return 1 - occ * 0.12;
}
function axisIndex(t) { return t[0] ? 0 : t[1] ? 1 : 2; }
function solidAt(get, x, y, z) { const id = get(x, y, z); return id !== 0 && Blocks[id].opaque; }

function emitSolidFace(arr, get, lx, y, lz, f, fi, ti, baseL, bl, inset) {
  const vtx = [];
  for (let i = 0; i < 4; i++) {
    const p = f.c[i];
    const ao = vertexAO(get, lx, y, lz, f, p);
    const [u, v] = tileUVc(ti, UVQ[i][0], UVQ[i][1]);
    let px = lx + p[0], py = y + p[1], pz = lz + p[2];
    if (inset) {
      if (f.d[0]) px -= f.d[0] * inset;
      if (f.d[2]) pz -= f.d[2] * inset;
    }
    vtx.push([px, py, pz, u, v, Math.max(0.06, baseL * ao), bl * ao]);
  }
  pushQuad(arr, vtx);
}
