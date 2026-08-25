'use strict';
// ---------------------------------------------------------------- other dimensions
// Terrain for the Nether and The End, plus the overworld stronghold that holds
// the End portal. The overworld generator itself stays in world.js.

const NETHER_LAVA = 31, END_Y = 48, END_R = 42;

// ---------------------------------------------------------------- the Nether
function genNether(world, c, cx, cz) {
  const s = world.seed ^ 0x4E37;
  for (let lx = 0; lx < CHUNK; lx++) for (let lz = 0; lz < CHUNK; lz++) {
    const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz;
    for (let y = 0; y < WORLD_H; y++) {
      let id = 0;
      if (y === 0 || y >= WORLD_H - 2) id = B.bedrock;
      else if (y === 1 && hash3(s, wx, y, wz) < 0.6) id = B.bedrock;
      else if (y === WORLD_H - 3 && hash3(s, wx, y, wz) < 0.6) id = B.bedrock;
      else {
        // caverns carved out of a solid netherrack slab
        const n = noise3(s, wx / 26, y / 17, wz / 26);
        const n2 = noise3(s ^ 0x99, wx / 13, y / 11, wz / 13);
        const openness = n * 0.68 + n2 * 0.32;
        // squeeze the roof and floor closed so the world feels enclosed
        const edge = Math.min(y / 12, (WORLD_H - 4 - y) / 14, 1);
        const solid = openness < 0.42 + (1 - edge) * 0.45;
        if (solid) {
          id = B.netherrack;
          const r = hash3(s ^ 0x77, wx, y, wz);
          if (r < 0.008 && y > 12) id = B.quartz_ore;
          else if (r > 0.994 && y < NETHER_LAVA + 8) id = B.soul_sand;
        } else if (y <= NETHER_LAVA) id = B.lava;
      }
      if (id) c.set(lx, y, lz, id);
    }
  }
}

function popNether(world, c, cx, cz) {
  const rng = mulberry32(world.seed ^ 0xF0E7 ^ Math.imul(cx, 341873128) ^ Math.imul(cz, 132897987));
  // glowstone clusters hanging from cavern ceilings
  for (let tries = 0; tries < 26; tries++) {
    const lx = (rng() * CHUNK) | 0, lz = (rng() * CHUNK) | 0;
    const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz;
    for (let y = WORLD_H - 6; y > NETHER_LAVA + 4; y--) {
      if (world.getBlock(wx, y, wz) === B.netherrack && world.getBlock(wx, y - 1, wz) === 0) {
        if (rng() < 0.35) {
          const n = 2 + (rng() * 4 | 0);
          for (let k = 0; k < n; k++) {
            const gx = wx + (rng() * 3 | 0) - 1, gz = wz + (rng() * 3 | 0) - 1;
            const gy = y - 1 - (rng() * 2 | 0);
            if (world.getBlock(gx, gy, gz) === 0) world.setBlockRaw(gx, gy, gz, B.glowstone);
          }
        }
        break;
      }
    }
  }
  // a nether fortress: brick platform and walkways, home to the blazes
  if (fortressHere(world.seed, cx, cz)) {
    const y0 = NETHER_LAVA + 12 + ((rng() * 10) | 0);
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    for (let x = 0; x < 14; x++) for (let z = 0; z < 14; z++) {
      // clear headroom, then lay the floor
      for (let y = y0 + 1; y < y0 + 7; y++) world.setBlockRaw(x0 + x, y, z0 + z, 0);
      world.setBlockRaw(x0 + x, y0, z0 + z, B.nether_bricks);
      const wall = x === 0 || z === 0 || x === 13 || z === 13;
      if (wall) for (let y = y0 + 1; y <= y0 + 3; y++) {
        if ((x + z) % 4 !== 0 || y > y0 + 2) world.setBlockRaw(x0 + x, y, z0 + z, B.nether_bricks);
      }
    }
    // support columns down toward the lava
    for (const [px, pz] of [[1, 1], [12, 1], [1, 12], [12, 12]])
      for (let y = y0 - 1; y > y0 - 14; y--) world.setBlockRaw(x0 + px, y, z0 + pz, B.nether_bricks);
    world.setBlockRaw(x0 + 7, y0 + 1, z0 + 7, B.glowstone);
    // loot for the trip home
    const key = (x0 + 4) + ',' + (y0 + 1) + ',' + (z0 + 4);
    world.setBlockRaw(x0 + 4, y0 + 1, z0 + 4, B.chest);
    if (!world.chests[key]) {
      const slots = new Array(27).fill(null);
      const loot = [[I.gold_ingot, 2, 5, 0.8], [I.iron_ingot, 1, 4, 0.6], [I.diamond, 1, 2, 0.25],
                    [B.glowstone, 2, 6, 0.5], [I.blaze_powder, 1, 2, 0.3], [I.flint_and_steel, 1, 1, 0.4]];
      for (const [id, a, b2, ch] of loot)
        if (rng() < ch) slots[(rng() * 27) | 0] = { id, count: a + ((rng() * (b2 - a + 1)) | 0) };
      world.chests[key] = slots;
    }
    world.fortressSpots.push([x0 + 7, y0 + 1, z0 + 7]);
  }
}
function fortressHere(seed, cx, cz) {
  // one fortress per 6x6 chunk region, at a fixed spot inside it
  const rx = Math.floor(cx / 6), rz = Math.floor(cz / 6);
  const h = hash2(seed ^ 0xF057, rx, rz);
  const ox = Math.floor(h * 5), oz = Math.floor(hash2(seed ^ 0xF058, rx, rz) * 5);
  return cx - rx * 6 === ox && cz - rz * 6 === oz;
}

// ---------------------------------------------------------------- The End
function endHeightAt(world, wx, wz) {
  const d = Math.hypot(wx, wz);
  if (d > END_R) return 0;
  const edge = 1 - d / END_R;
  const n = fbm2(world.seed ^ 0xE4D, wx / 34, wz / 34, 3, 2, 0.5);
  return Math.max(0, Math.floor(4 + edge * 16 + (n - 0.5) * 8));
}
function genEnd(world, c, cx, cz) {
  for (let lx = 0; lx < CHUNK; lx++) for (let lz = 0; lz < CHUNK; lz++) {
    const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz;
    const t = endHeightAt(world, wx, wz);
    if (t <= 0) continue;
    for (let y = END_Y - t; y <= END_Y; y++) c.set(lx, y, lz, B.end_stone);
  }
}

// the ring of obsidian pillars, each crowned with a crystal that heals the dragon
const END_PILLARS = [];
(function () {
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 30 + (i % 3) * 4;
    END_PILLARS.push({
      x: Math.round(Math.cos(a) * r), z: Math.round(Math.sin(a) * r),
      h: 13 + (i % 4) * 3, rad: i % 2 ? 2 : 3,
    });
  }
})();

function popEnd(world, c, cx, cz) {
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  for (const p of END_PILLARS) {
    if (p.x < x0 - 4 || p.x > x0 + CHUNK + 4 || p.z < z0 - 4 || p.z > z0 + CHUNK + 4) continue;
    for (let dx = -p.rad; dx <= p.rad; dx++) for (let dz = -p.rad; dz <= p.rad; dz++) {
      if (dx * dx + dz * dz > p.rad * p.rad + 1) continue;
      for (let y = END_Y - 6; y <= END_Y + p.h; y++) world.setBlockRaw(p.x + dx, y, p.z + dz, B.obsidian);
    }
    // bedrock plate the crystal sits on
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      world.setBlockRaw(p.x + dx, END_Y + p.h + 1, p.z + dz, B.bedrock);
  }
  // the exit portal at the island's heart, dormant until the dragon falls
  if (x0 <= 0 && x0 + CHUNK > 0 && z0 <= 0 && z0 + CHUNK > 0) {
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const r = Math.max(Math.abs(dx), Math.abs(dz));
      if (r === 2) world.setBlockRaw(dx, END_Y + 1, dz, B.bedrock);
      else world.setBlockRaw(dx, END_Y + 1, dz, world.dragonDead ? B.end_portal : 0);
    }
    world.setBlockRaw(0, END_Y + 2, 0, world.dragonDead ? 0 : B.bedrock);
  }
}

// ---------------------------------------------------------------- stronghold (overworld)
function strongholdPos(seed) {
  const a = hash2(seed ^ 0x5748, 17, 31) * Math.PI * 2;
  const d = 190 + hash2(seed ^ 0x5749, 31, 17) * 170;
  return { x: Math.round(Math.cos(a) * d), z: Math.round(Math.sin(a) * d), y: 20 };
}
function popStronghold(world, c, cx, cz) {
  const sp = world.strongholdPos();
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  if (sp.x < x0 - 10 || sp.x >= x0 + CHUNK + 10 || sp.z < z0 - 10 || sp.z >= z0 + CHUNK + 10) return;
  if (world.strongholdBuilt) return;
  world.strongholdBuilt = true;
  const rng = mulberry32(world.seed ^ 0xABCD);
  const { x: sx, z: sz } = sp, sy = sp.y;
  const R = 6, H = 6;
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) for (let dy = 0; dy <= H; dy++) {
    const wx = sx + dx, wy = sy + dy, wz = sz + dz;
    const shell = dx === -R || dx === R || dz === -R || dz === R || dy === 0 || dy === H;
    if (shell) world.setBlockRaw(wx, wy, wz, rng() < 0.3 ? B.mossy_cobblestone : B.stone_bricks);
    else world.setBlockRaw(wx, wy, wz, 0);
  }
  // the portal itself: twelve frames ringing a lava-lit well
  const py = sy + 1;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    const edge = Math.max(Math.abs(dx), Math.abs(dz)) === 2;
    const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
    if (edge && !corner) {
      // a few frames come already bearing an eye, as in the real thing
      world.setBlockRaw(sx + dx, py, sz + dz, rng() < 0.32 ? B.end_portal_frame_filled : B.end_portal_frame);
    } else if (!edge) {
      world.setBlockRaw(sx + dx, py, sz + dz, 0);
      world.setBlockRaw(sx + dx, py - 1, sz + dz, B.lava);
    }
  }
  for (const [tx, tz] of [[-R + 1, -R + 1], [R - 1, -R + 1], [-R + 1, R - 1], [R - 1, R - 1]])
    world.setBlockRaw(sx + tx, py, sz + tz, B.torch);
  // a library chest to reward the search
  const key = (sx + R - 1) + ',' + py + ',' + sz;
  world.setBlockRaw(sx + R - 1, py, sz, B.chest);
  if (!world.chests[key]) {
    const slots = new Array(27).fill(null);
    const loot = [[I.eye_of_ender, 1, 2, 0.5], [I.diamond, 1, 3, 0.5], [I.iron_ingot, 2, 5, 0.7],
                  [I.apple, 1, 3, 0.6], [I.bread, 1, 3, 0.6], [B.torch, 4, 8, 0.7]];
    for (const [id, a, b2, ch] of loot)
      if (rng() < ch) slots[(rng() * 27) | 0] = { id, count: a + ((rng() * (b2 - a + 1)) | 0) };
    world.chests[key] = slots;
  }
  // a shaft up toward daylight so it can be found by digging down too
  for (let y = sy + H; y < WORLD_H - 4; y++) {
    if (world.getBlock(sx, y, sz) === 0 && y > sy + H + 4) break;
    world.setBlockRaw(sx, y, sz, 0);
  }
}
