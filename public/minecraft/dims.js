'use strict';
// ---------------------------------------------------------------- travel, portals, the boss fight, creative mode
// Everything that spans dimensions lives here and is mixed into Game.

Object.assign(Game, {

  // ---------------- chunk pregeneration ----------------
  pregen(x, z) {
    const cx0 = Math.floor(x / CHUNK), cz0 = Math.floor(z / CHUNK);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      this.world.ensureChunk(cx0 + dx, cz0 + dz);
  },

  // ---------------- moving between worlds ----------------
  travel(dim, dest) {
    if (dim === this.dim) return;
    const from = this.dim;
    // park this dimension's entities so they are still here when we come back
    this.dimEnts[from] = {
      mobs: this.mobs, drops: this.drops, arrows: this.arrows,
      xporbs: this.xporbs, tnts: this.tnts, fireballs: this.fireballs,
    };
    for (const c of this.world.chunks.values()) Renderer.dropChunk(c);

    this.dim = dim;
    this.world = this.worlds[dim];
    const back = this.dimEnts[dim] || {};
    this.mobs = back.mobs || []; this.drops = back.drops || [];
    this.arrows = back.arrows || []; this.xporbs = back.xporbs || [];
    this.tnts = back.tnts || []; this.fireballs = back.fireballs || [];
    this.crystals = []; this.dragon = null;
    this.particles.list.length = 0;

    const p = this.player;
    p.x = dest.x; p.z = dest.z;
    this.pregen(p.x, p.z);
    p.y = dest.y !== undefined ? dest.y : this.findSpawnY(p.x, p.z);
    p.vx = p.vy = p.vz = 0;
    p.fallStart = null;
    p.portalT = 0; p.portalCool = 2.5;
    for (const c of this.world.chunks.values()) c.dirty = true;

    if (dim === 'end') this.startEndFight();
    const names = { overworld: 'the Overworld', nether: 'the Nether', end: 'The End' };
    this.msg('Entering ' + names[dim]);
    Sfx.portal();
    this.ach('travel_' + dim, dim === 'nether' ? 'We Need to Go Deeper'
      : dim === 'end' ? 'The End?' : 'Home Again');
    UI.refreshBoss(this.dragon);
    this.save();
  },

  // standing in a portal for a moment carries you across
  checkPortal(dt) {
    const p = this.player;
    if (p.portalCool > 0) { p.portalCool -= dt; }
    const id = this.world.getBlock(p.x, p.y + 0.8, p.z);
    const def = id ? Blocks[id] : null;
    const inPortal = def && def.portal;
    if (!inPortal || p.portalCool > 0) {
      p.portalT = Math.max(0, (p.portalT || 0) - dt * 2);
      return;
    }
    p.portalT = (p.portalT || 0) + dt;
    if (Math.random() < 0.3)
      this.particles.burst(p.x, p.y + 1, p.z, def.portal === 'end' ? TileIdx.end_portal : TileIdx.nether_portal, 1, 1);
    if (p.portalT < 1.1) return;
    p.portalT = 0;
    if (def.portal === 'nether') {
      if (this.dim === 'nether') this.travel('overworld', this.linkPortal('overworld', p.x * 8, p.z * 8));
      else this.travel('nether', this.linkPortal('nether', p.x / 8, p.z / 8));
    } else {
      if (this.dim === 'end') this.travel('overworld', { x: p.spawn.x, y: undefined, z: p.spawn.z });
      else this.travel('end', { x: 0.5, y: END_Y + 2, z: 12.5 });
    }
  },

  // find a portal near the destination, or carve out somewhere safe and build one
  linkPortal(dim, x, z) {
    const w = this.worlds[dim];
    const bx = Math.floor(x), bz = Math.floor(z);
    const prev = this.world; this.world = w;
    this.pregen(bx, bz);
    this.world = prev;
    // look for an existing portal nearby
    for (let r = 0; r <= 12; r += 2) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        for (let y = 6; y < WORLD_H - 6; y++) {
          if (w.getBlock(bx + dx, y, bz + dz) === B.nether_portal)
            return { x: bx + dx + 0.5, y, z: bz + dz + 0.5 };
        }
      }
    }
    // otherwise build the far side of the gateway
    let y = dim === 'nether' ? 40 : SEA + 2;
    if (dim === 'nether') {
      for (let ty = 34; ty < 90; ty++) {
        let clear = true;
        for (let h = 0; h < 5; h++) if (w.getBlock(bx, ty + h, bz) !== 0) { clear = false; break; }
        if (clear && w.getBlock(bx, ty - 1, bz) !== 0 && w.getBlock(bx, ty - 1, bz) !== B.lava) { y = ty; break; }
      }
    } else {
      for (let ty = WORLD_H - 8; ty > 4; ty--) {
        const b = w.getBlock(bx, ty, bz);
        if (b && Blocks[b].solid) { y = ty + 1; break; }
      }
    }
    for (let dx = -1; dx <= 3; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 5; dy++)
      if (dy === -1) w.setBlockRaw(bx + dx, y + dy, bz + dz, B.obsidian);
      else w.setBlockRaw(bx + dx, y + dy, bz + dz, 0);
    this.buildPortal(w, bx, y, bz, 'x');
    return { x: bx + 0.5, y, z: bz + 0.5 };
  },

  // a 4x5 obsidian frame filled with portal
  buildPortal(w, x, y, z, axis) {
    for (let i = -1; i <= 2; i++) for (let j = -1; j <= 4; j++) {
      const bx = axis === 'x' ? x + i : x, bz = axis === 'x' ? z : z + i;
      const edge = i === -1 || i === 2 || j === -1 || j === 4;
      if (edge) w.setBlockRaw(bx, y + j, bz, B.obsidian);
      else w.setBlockRaw(bx, y + j, bz, B.nether_portal);
    }
  },

  // flint and steel: find the air pocket inside an obsidian frame and fill it
  lightPortal(x, y, z) {
    const starts = [[x, y + 1, z], [x + 1, y, z], [x - 1, y, z], [x, y, z + 1], [x, y, z - 1]];
    for (const axis of ['x', 'z']) {
      for (const [sx, sy, sz] of starts) {
        if (this.world.getBlock(sx, sy, sz) !== 0) continue;
        const cells = this.portalRegion(sx, sy, sz, axis);
        if (!cells) continue;
        for (const [cx, cy, cz] of cells) this.world.setBlock(cx, cy, cz, B.nether_portal);
        Sfx.portal();
        this.msg('The portal roars to life');
        this.ach('portal', 'Into the Fire');
        return true;
      }
    }
    return false;
  },

  // flood the air inside the frame; anything that leaks or hits a stray block fails
  portalRegion(sx, sy, sz, axis) {
    const w = this.world;
    const seen = new Set(), out = [], q = [[sx, sy, sz]];
    while (q.length) {
      const [cx, cy, cz] = q.pop();
      const k = cx + ',' + cy + ',' + cz;
      if (seen.has(k)) continue;
      seen.add(k);
      const id = w.getBlock(cx, cy, cz);
      if (id === B.obsidian) continue;      // the frame: a good edge to stop at
      if (id !== 0) return null;            // anything else means this is not a frame
      out.push([cx, cy, cz]);
      if (out.length > 24) return null;     // leaked into the open world
      if (axis === 'x') q.push([cx + 1, cy, cz], [cx - 1, cy, cz]);
      else q.push([cx, cy, cz + 1], [cx, cy, cz - 1]);
      q.push([cx, cy + 1, cz], [cx, cy - 1, cz]);
    }
    return out.length >= 6 ? out : null;
  },

  // eye of ender: fills a frame, or is thrown to point the way to the stronghold
  fillFrame(x, y, z) {
    this.world.setBlock(x, y, z, B.end_portal_frame_filled);
    this.inv.consumeHeld();
    Sfx.pop();
    // when the ring is complete the portal opens
    const sp = this.worlds.overworld.strongholdPos();
    let filled = 0, total = 0;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const edge = Math.max(Math.abs(dx), Math.abs(dz)) === 2;
      const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
      if (!edge || corner) continue;
      total++;
      const id = this.world.getBlock(sp.x + dx, sp.y + 1, sp.z + dz);
      if (id === B.end_portal_frame_filled) filled++;
    }
    if (filled >= total && total > 0) {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
        this.world.setBlock(sp.x + dx, sp.y + 1, sp.z + dz, B.end_portal);
      this.msg('The End portal opens!');
      Sfx.portal();
      this.ach('eyes', 'Eye Spy');
    } else this.msg(`Eyes placed: ${filled} / ${total}`);
  },

  throwEye() {
    const p = this.player;
    const sp = this.worlds.overworld.strongholdPos();
    this.eyes = this.eyes || [];
    const dx = sp.x - p.x, dz = sp.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    this.eyes.push({
      x: p.x, y: p.y + 1.4, z: p.z,
      vx: dx / d * 12, vz: dz / d * 12, t: 0,
      keep: Math.random() < 0.8,
    });
    this.inv.consumeHeld();
    Sfx.pop();
    this.msg(d < 40 ? 'The eye barely moves — the stronghold is right here'
      : `The eye streaks off — the stronghold is ${Math.round(d)} blocks away`);
  },

  updateEyes(dt) {
    if (!this.eyes || !this.eyes.length) return;
    for (const e of this.eyes) {
      e.t += dt;
      e.x += e.vx * dt; e.z += e.vz * dt;
      e.y += (e.t < 0.5 ? 4 : -1) * dt;
      if (Math.random() < 0.6) this.particles.burst(e.x, e.y, e.z, Items[I.eye_of_ender].icon, 1, 0.3);
      if (e.t > 1.6 && e.keep) { this.spawnDrop(e.x, e.y, e.z, I.eye_of_ender, 1); e.done = true; }
      else if (e.t > 1.6) e.done = true;
    }
    this.eyes = this.eyes.filter(e => !e.done);
  },

  // ---------------- the End fight ----------------
  startEndFight() {
    this.crystals = [];
    if (this.world.dragonDead) return;
    for (const p of END_PILLARS)
      this.crystals.push(new EndCrystal(p.x + 0.5, END_Y + p.h + 2, p.z + 0.5));
    this.dragon = new EnderDragon();
    this.msg('The Ender Dragon guards this place');
    Sfx.dragon();
    UI.refreshBoss(this.dragon);
  },

  onDragonSlain() {
    this.world.dragonDead = true;
    this.dragon = null;
    UI.refreshBoss(null);
    this.spawnXp(0, END_Y + 6, 0, 60);
    // the way home opens, and a trophy sits on top of it
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const r = Math.max(Math.abs(dx), Math.abs(dz));
      if (r < 2) this.world.setBlock(dx, END_Y + 1, dz, B.end_portal);
    }
    this.world.setBlock(0, END_Y + 2, 0, B.dragon_egg);
    this.stats.wonAt = Math.round(this.stats.playTime);
    this.ach('dragon', 'Free the End');
    this.save();
    setTimeout(() => this.showCredits(), 2200);
  },

  showCredits() {
    this.state = 'credits';
    const el = document.getElementById('credits');
    const s = this.stats;
    document.getElementById('creditstats').innerHTML =
      `Blocks mined <b>${s.mined}</b> · placed <b>${s.placed}</b><br>` +
      `Mobs slain <b>${s.kills}</b> · items crafted <b>${s.crafted}</b><br>` +
      `Time played <b>${Math.floor(s.playTime / 60)}m ${Math.round(s.playTime % 60)}s</b>`;
    el.classList.remove('hidden');
    document.exitPointerLock();
    Sfx.levelup();
  },
  closeCredits() {
    document.getElementById('credits').classList.add('hidden');
    this.state = 'playing';
    this.lockPointer();
  },

  // ---------------- creative mode ----------------
  setCreative(on) {
    this.creative = on;
    const p = this.player;
    if (p) {
      p.flying = false;
      p.hp = p.maxHp; p.hunger = 20;
      if (on) { p.fallStart = null; }
    }
    UI.setGameMode(on);
    this.msg(on ? 'Creative mode' : 'Survival mode');
  },

  // ---------------- dimension-aware spawning ----------------
  trySpawnDim() {
    const p = this.player;
    if (this.dim === 'nether') {
      if (this.mobs.length >= 14) return;
      const w = this.world;
      // blazes keep to their fortresses; pigmen and ghasts roam
      if (w.fortressSpots.length && Math.random() < 0.4) {
        const spot = w.fortressSpots[randInt(0, w.fortressSpots.length - 1)];
        if (dist2(spot[0], spot[1], spot[2], p.x, p.y, p.z) < 60 * 60)
          this.mobs.push(new Mob('blaze', spot[0] + rand(-4, 4), spot[1] + 2, spot[2] + rand(-4, 4)));
        return;
      }
      const ang = rand(0, Math.PI * 2), dd = rand(22, 44);
      const x = p.x + Math.cos(ang) * dd, z = p.z + Math.sin(ang) * dd;
      if (!this.world.chunkAt(x, z)) return;
      if (Math.random() < 0.35) {
        this.mobs.push(new Mob('ghast', x, p.y + rand(6, 16), z));
      } else {
        const y = this.findSpawnY(x, z);
        if (y > NETHER_LAVA + 2 && y < WORLD_H - 6) this.mobs.push(new Mob('pigman', x, y, z));
      }
      return;
    }
    if (this.dim === 'end') {
      if (this.mobs.length >= 8) return;
      const ang = rand(0, Math.PI * 2), dd = rand(14, 34);
      const x = p.x + Math.cos(ang) * dd, z = p.z + Math.sin(ang) * dd;
      if (Math.hypot(x, z) > END_R - 3) return;
      const y = this.findSpawnY(x, z);
      if (y > 4) this.mobs.push(new Mob('enderman', x, y, z));
      return;
    }
    // overworld: the usual night crowd, with the odd enderman among them
    if (Math.random() < 0.12 && this.day < 0.4) {
      const ang = rand(0, Math.PI * 2), dd = rand(26, 48);
      const x = p.x + Math.cos(ang) * dd, z = p.z + Math.sin(ang) * dd;
      if (!this.world.chunkAt(x, z)) return;
      const y = this.findSpawnY(x, z);
      if (y > SEA && this.world.skyAt(x, y, z) < 0.5) this.mobs.push(new Mob('enderman', x, y, z));
      return;
    }
    this.trySpawnHostile();
  },
});
