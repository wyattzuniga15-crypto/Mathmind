'use strict';
// ---------------------------------------------------------------- game orchestration

const SAVE_KEY = 'blockcraft_save_v1';
const DAY_LENGTH = 600; // seconds per full day

const Game = {
  state: 'title',   // title | loading | playing | paused | dead
  world: null, player: null, inv: null,
  mobs: [], drops: [], arrows: [], xporbs: [], tnts: [],
  particles: new Particles(),
  target: null,
  dayTime: 0.3, day: 1,
  timeSec: 0, lastFrame: 0, fps: 0,
  attackCd: 0, lightScanT: 0, saveT: 0, spawnT: 0, passiveT: 0,
  growths: [],
  stats: { kills: 0, mined: 0, placed: 0, crafted: 0, playTime: 0, ach: {} },

  ach(id, text) {
    if (!this.stats.ach) this.stats.ach = {};
    if (this.stats.ach[id]) return;
    this.stats.ach[id] = true;
    this.msg('🏆 Achievement: ' + text);
    Sfx.levelup();
  },
  canvas: null,
  debugOn: false,

  // ---------------- boot ----------------
  boot() {
    this.canvas = document.getElementById('glcanvas');
    Renderer.init(this.canvas);
    this.inv = new Inventory();
    UI.init(this);
    Input.init(this.canvas, this);
    Input.onLock = locked => {
      // ignore unlock events fired during UI open/close transitions
      if (!locked && this.state === 'playing' && !Input.uiOpen &&
          performance.now() - (this._uiT || 0) > 600) this.pause();
    };
    this.drawTitleBg();
    const hasSave = !!localStorage.getItem(SAVE_KEY);
    document.getElementById('worldinfo').textContent = hasSave ? 'Saved world found — Play resumes it' : '';
    if (!window.matchMedia('(pointer:fine)').matches) {
      const warn = document.createElement('div');
      warn.style.cssText = 'position:relative;color:#ffb3b3;font-size:14px;margin-top:14px;text-shadow:1px 1px #000;text-align:center';
      warn.textContent = 'Heads up: BlockCraft needs a mouse and keyboard to play.';
      document.getElementById('btnplay').after(warn);
    }
    document.getElementById('btnplay').addEventListener('click', () => { Sfx.click(); this.startSurvival(); });
    document.getElementById('btnresume').addEventListener('click', () => { Sfx.click(); this.resume(); });
    document.getElementById('btnquit').addEventListener('click', () => { Sfx.click(); this.quitToTitle(); });
    document.getElementById('btnrespawn').addEventListener('click', () => { Sfx.click(); this.respawn(); });
    window.addEventListener('beforeunload', () => { if (this.world) this.save(); });
    window.addEventListener('resize', () => Renderer.resize());
    requestAnimationFrame(t => this.frame(t));
  },

  drawTitleBg() {
    const cv = document.getElementById('title-bg');
    cv.width = 640; cv.height = 360;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, '#6ab0f0'); g.addColorStop(0.6, '#a8d2f5'); g.addColorStop(0.61, '#3f7a2c'); g.addColorStop(1, '#2c5a1e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 640, 360);
    ctx.imageSmoothingEnabled = false;
    const rng = mulberry32(7);
    for (let i = 0; i < 60; i++) {
      const id = [B.grass_block, B.stone, B.oak_log, B.oak_leaves, B.dirt][((rng() * 5) | 0)];
      const t = Blocks[id].tiles;
      const [sx, sy] = tileXY(t.side);
      const s = 20 + rng() * 26;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(atlasCanvas, sx, sy, TILE, TILE, rng() * 640, 216 + rng() * 150 - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  },

  // ---------------- world start ----------------
  startSurvival() {
    document.getElementById('title').classList.add('hidden');
    document.getElementById('loading').classList.remove('hidden');
    const saved = localStorage.getItem(SAVE_KEY);
    let data = null;
    if (saved) { try { data = JSON.parse(saved); } catch (e) { data = null; } }
    this.world = new World(data ? data.seed : (Math.random() * 0xFFFFFFFF) >>> 0);
    if (data) {
      this.world.loadDiffs(data.diffs);
      this.world.furnaces = data.furnaces || {};
      this.world.chests = data.chests || {};
      this.dayTime = data.time ?? 0.3;
    } else this.dayTime = 0.3;

    // find spawn point on land
    let sx = 8, sz = 8;
    if (data && data.player) { sx = data.player.x; sz = data.player.z; }
    else {
      for (let r = 0; r < 40; r++) {
        const tx = randInt(-60, 60), tz = randInt(-60, 60);
        if (this.world.heightAt(tx, tz) > SEA + 2 && this.world.biomeAt(tx, tz) !== 'mountains') { sx = tx + 0.5; sz = tz + 0.5; break; }
      }
    }

    // pregenerate around spawn with progress bar
    const jobs = [];
    const cx0 = Math.floor(sx / CHUNK), cz0 = Math.floor(sz / CHUNK);
    for (let dx = -VIEW_R; dx <= VIEW_R; dx++) for (let dz = -VIEW_R; dz <= VIEW_R; dz++)
      if (dx * dx + dz * dz <= (VIEW_R + 0.5) ** 2) jobs.push([cx0 + dx, cz0 + dz]);
    jobs.sort((a, b2) => (a[0] - cx0) ** 2 + (a[1] - cz0) ** 2 - ((b2[0] - cx0) ** 2 + (b2[1] - cz0) ** 2));
    let ji = 0;
    const bar = document.querySelector('#loadbar div');
    const step = () => {
      const t0 = performance.now();
      while (ji < jobs.length && performance.now() - t0 < 30) {
        this.world.ensureChunk(jobs[ji][0], jobs[ji][1]);
        ji++;
      }
      bar.style.width = Math.floor(ji / jobs.length * 100) + '%';
      if (ji < jobs.length) { setTimeout(step, 0); return; }
      this.finishStart(sx, sz, data);
    };
    step();
  },

  finishStart(sx, sz, data) {
    this.player = new Player(sx, this.findSpawnY(sx, sz), sz);
    if (data && data.player) {
      const p = data.player;
      this.player.x = p.x; this.player.y = p.y; this.player.z = p.z;
      this.player.yaw = p.yaw || 0; this.player.pitch = p.pitch || 0;
      this.player.hp = p.hp ?? 20; this.player.hunger = p.hunger ?? 20;
      this.player.xp = p.xp || 0;
      this.player.spawn = p.spawn || { x: sx, y: this.player.y, z: sz };
      this.inv.load(p.inv);
      this.stats = p.stats || this.stats;
      this.stats.ach = this.stats.ach || {};
      if (this.world.getBlock(this.player.x, this.player.y, this.player.z) !== 0)
        this.player.y = this.findSpawnY(this.player.x, this.player.z);
    } else {
      this.player.spawn = { x: sx, y: this.player.y, z: sz };
    }
    this.mobs = []; this.drops = []; this.arrows = []; this.xporbs = []; this.tnts = [];
    UI.refreshXp(this.player);
    // seed some passive mobs nearby
    for (let i = 0; i < 14; i++) this.trySpawnPassive(true);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.state = 'playing';
    UI.refreshHotbar();
    UI.refreshStats(this.player);
    this.msg(data ? 'Welcome back!' : 'Punch trees to gather wood');
    this.lockPointer();
  },

  lockPointer() {
    this._uiT = performance.now();
    try {
      const r = this.canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch (e) {}
  },

  findSpawnY(x, z) {
    for (let y = WORLD_H - 2; y > 0; y--) {
      const id = this.world.getBlock(x, y, z);
      if (id && Blocks[id].solid) return y + 1.01;
    }
    return SEA + 2;
  },

  // ---------------- state transitions ----------------
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.getElementById('pause').classList.remove('hidden');
    this.save();
  },
  resume() {
    document.getElementById('pause').classList.add('hidden');
    this.state = 'playing';
    this.lockPointer();
  },
  quitToTitle() {
    this.save();
    location.reload();
  },
  onPlayerDeath() {
    // scatter inventory
    for (let i = 0; i < 36; i++) {
      const s = this.inv.slots[i];
      if (s) this.spawnDrop(this.player.x, this.player.y + 1, this.player.z, s.id, s.count);
      this.inv.slots[i] = null;
    }
    UI.refreshHotbar();
    UI.close();
    this.state = 'dead';
    document.getElementById('deathscore').textContent =
      `Mobs slain: ${this.stats.kills} · Blocks mined: ${this.stats.mined}`;
    document.getElementById('death').classList.remove('hidden');
    document.exitPointerLock();
  },
  respawn() {
    document.getElementById('death').classList.add('hidden');
    this.player.respawn(this);
    this.state = 'playing';
    this.lockPointer();
  },

  save() {
    if (!this.world || !this.player) return;
    try {
      const p = this.player;
      localStorage.setItem(SAVE_KEY, this.world.serialize({
        x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch,
        hp: p.hp, hunger: p.hunger, xp: p.xp, spawn: p.spawn,
        inv: this.inv.serialize(), stats: this.stats,
      }, this.dayTime));
    } catch (e) { console.warn('save failed', e); }
  },

  // ---------------- keys ----------------
  onKey(code, e) {
    if (this.state === 'dead' && (code === 'Enter' || code === 'Space')) { this.respawn(); return; }
    if (this.state === 'playing' || this.state === 'paused') {
      if (code === 'KeyE') {
        if (Input.uiOpen) UI.close();
        else if (this.state === 'playing') { UI.open('inv'); }
        e.preventDefault();
      } else if (code === 'Escape' && Input.uiOpen) {
        UI.close();
      } else if (code === 'KeyQ' && !Input.uiOpen && this.state === 'playing') {
        const s = this.inv.held();
        if (s) { this.dropFromPlayer(s.id, 1); this.inv.consumeHeld(); }
      } else if (code === 'KeyM') {
        Sfx.musicOn = !Sfx.musicOn;
        this.msg(Sfx.musicOn ? 'Music on' : 'Music off');
      } else if (code === 'F3') {
        this.debugOn = !this.debugOn;
        document.getElementById('debug').style.display = this.debugOn ? 'block' : 'none';
        e.preventDefault();
      } else if (/^Digit[1-9]$/.test(code) && !Input.uiOpen) {
        this.inv.sel = +code.slice(5) - 1;
        UI.refreshHotbar(); UI.showItemName();
      }
    }
  },

  // ---------------- block actions ----------------
  breakBlock(x, y, z, heldId) {
    const id = this.world.getBlock(x, y, z);
    if (!id) return;
    const b = Blocks[id];
    Sfx.breakBlk(id);
    this.particles.burst(x + 0.5, y + 0.5, z + 0.5, b.tiles ? b.tiles.side : TileIdx.white, 14, 2.5);
    this.world.setBlock(x, y, z, 0);
    const d = blockDrops(id, heldId);
    if (d) this.spawnDrop(x + 0.5, y + 0.3, z + 0.5, d[0], d[1]);
    // mining xp for ores (only when they actually drop)
    if (d) {
      const xp = { [B.coal_ore]: 1, [B.iron_ore]: 1, [B.gold_ore]: 2, [B.diamond_ore]: 4 }[id];
      if (xp) this.spawnXp(x + 0.5, y + 0.5, z + 0.5, xp);
    }
    if (id === B.chest) {
      const key = x + ',' + y + ',' + z;
      const c = this.world.chests[key];
      if (c) for (const s of c) if (s) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, s.id, s.count);
      delete this.world.chests[key];
    }
    this.stats.mined++;
    if (b.hardness > 0.1) this.inv.damageHeld(this);
  },
  placeBlock(x, y, z, id) {
    this.world.setBlock(x, y, z, id);
    this.inv.consumeHeld();
    Sfx.place();
    this.stats.placed++;
    if (id === B.oak_sapling) this.growths.push({ x, y, z, at: this.timeSec + rand(30, 70) });
  },
  pickBlock() {
    if (!this.target) return;
    const id = this.target.id;
    for (let i = 0; i < 36; i++) {
      const s = this.inv.slots[i];
      if (s && s.id === id) {
        if (i < 9) this.inv.sel = i;
        else { const tmp = this.inv.slots[this.inv.sel]; this.inv.slots[this.inv.sel] = s; this.inv.slots[i] = tmp; }
        UI.refreshHotbar(); UI.showItemName();
        return;
      }
    }
  },
  giveItem(id, count) {
    if (id === B.oak_log) this.ach('wood', 'Getting Wood');
    else if (id === I.diamond) this.ach('diamond', 'DIAMONDS!');
    else if (id === I.iron_ingot) this.ach('iron', 'Acquire Hardware');
    return this.inv.give(id, count);
  },
  spawnDrop(x, y, z, id, count) { this.drops.push(new Drop(x, y, z, id, count)); },
  spawnXp(x, y, z, n) {
    while (n > 0) { const v = Math.min(n, randInt(1, 3)); n -= v; this.xporbs.push(new XpOrb(x, y, z, v)); }
  },
  dropFromPlayer(id, count) {
    const p = this.player, look = p.lookDir();
    const d = new Drop(p.x + look[0] * 0.6, p.y + 1.3, p.z + look[2] * 0.6, id, count);
    d.vx = look[0] * 5; d.vy = 2.5; d.vz = look[2] * 5;
    d.pickupDelay = 1.5;
    this.drops.push(d);
  },

  tryAttack() {
    if (this.attackCd > 0) return this._lastAttackHit || false;
    const p = this.player, look = p.lookDir();
    for (const m of this.mobs) {
      // ray vs expanded AABB by sampling
      for (let t = 0.5; t <= 3.5; t += 0.25) {
        const px = p.x + look[0] * t, py = p.y + p.eye + look[1] * t, pz = p.z + look[2] * t;
        if (px > m.x - m.w - 0.15 && px < m.x + m.w + 0.15 &&
            pz > m.z - m.w - 0.15 && pz < m.z + m.w + 0.15 &&
            py > m.y - 0.1 && py < m.y + m.h + 0.15) {
          this.attackCd = 0.45;
          this._lastAttackHit = true;
          const held = this.inv.held();
          const dmg = held ? itemDef(held.id).dmg || 1 : 1;
          const dl = Math.hypot(look[0], look[2]) || 1;
          m.hurt(this, dmg, look[0] / dl * 0.6, look[2] / dl * 0.6);
          if (held && held.dur !== undefined) this.inv.damageHeld(this);
          p.exhaustion += 0.1;
          setTimeout(() => this._lastAttackHit = false, 300);
          return true;
        }
      }
    }
    return false;
  },

  explode(x, y, z, radius, maxDmg) {
    Sfx.explosion();
    this.particles.burst(x, y, z, TileIdx.bedrock, 40, 6);
    const r = Math.ceil(radius);
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > radius + (Math.random() - 0.5)) continue;
      const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz);
      const id = this.world.getBlock(bx, by, bz);
      if (!id || id === B.water) continue;
      if (Blocks[id].hardness < 0 || Blocks[id].hardness > 50) continue;
      if (id === B.tnt) { this.igniteTnt(bx, by, bz, rand(0.4, 1.2)); continue; }
      this.world.setBlock(bx, by, bz, 0);
      if (Math.random() < 0.25) {
        const drop = blockDrops(id, 999);
        if (drop) this.spawnDrop(bx + 0.5, by + 0.5, bz + 0.5, drop[0], drop[1]);
      }
    }
    // damage entities
    const hurtE = (e, isPlayer) => {
      const d = Math.sqrt(dist2(x, y, z, e.x, e.y + (isPlayer ? 1 : e.h / 2), e.z));
      if (d < radius * 2.4) {
        const dmg = Math.max(1, Math.round(maxDmg * (1 - d / (radius * 2.4))));
        const kx = (e.x - x) / (d || 1), kz = (e.z - z) / (d || 1);
        e.hurt(this, dmg, kx, kz);
      }
    };
    hurtE(this.player, true);
    for (const m of this.mobs) if (!m.dead) hurtE(m, false);
  },

  // ---------------- interactables ----------------
  igniteTnt(x, y, z, fuse = 3) {
    this.world.setBlock(x, y, z, 0);
    this.tnts.push(new Tnt(x + 0.5, y, z + 0.5, fuse));
    Sfx.fuse();
    this.ach('tnt', 'Demolition Expert');
  },

  sleep(x, y, z) {
    this.player.spawn = { x: x + 0.5, y: y + 1, z: z + 0.5 };
    if (this.day > 0.2) { this.msg('Respawn point set — you can only sleep at night'); return; }
    if (this.mobs.some(m => m.def.hostile && dist2(m.x, m.y, m.z, x, y, z) < 14 * 14)) {
      this.msg('You may not rest now, there are monsters nearby');
      return;
    }
    this.dayTime = 0.27;
    // undead don't survive the sunrise skip
    for (const m of this.mobs) if (m.def.burns) m.dead = true;
    this.msg('You wake up refreshed');
    this.ach('sleep', 'Sweet Dreams');
    Sfx.levelup();
  },

  openCrafting() { UI.open('table'); },
  openFurnace(x, y, z) {
    const key = x + ',' + y + ',' + z;
    if (!this.world.furnaces[key])
      this.world.furnaces[key] = { in: null, fuel: null, out: null, burn: 0, burnMax: 0, prog: 0, pos: [x, y, z] };
    this.world.furnaces[key].pos = [x, y, z];
    UI.open('furnace', this.world.furnaces[key]);
  },
  openChest(x, y, z) {
    const key = x + ',' + y + ',' + z;
    if (!this.world.chests[key]) this.world.chests[key] = new Array(27).fill(null);
    UI.open('chest', this.world.chests[key]);
  },

  tickFurnaces(dt) {
    for (const key in this.world.furnaces) {
      const f = this.world.furnaces[key];
      const canSmelt = f.in && Smelting[f.in.id] !== undefined &&
        (!f.out || (f.out.id === Smelting[f.in.id] && f.out.count < maxStack(f.out.id)));
      if (f.burn > 0) {
        f.burn -= dt;
        if (canSmelt) {
          f.prog += dt / 10;
          if (f.prog >= 1) {
            f.prog = 0;
            const outId = Smelting[f.in.id];
            if (f.out) f.out.count++;
            else f.out = { id: outId, count: 1 };
            f.in.count--;
            if (f.in.count <= 0) f.in = null;
          }
        } else f.prog = Math.max(0, f.prog - dt / 5);
        if (f.burn <= 0) f.burn = 0;
      }
      if (f.burn <= 0) {
        if (canSmelt && f.fuel && fuelTime(f.fuel.id) > 0) {
          f.burnMax = fuelTime(f.fuel.id);
          f.burn = f.burnMax;
          f.fuel.count--;
          if (f.fuel.count <= 0) f.fuel = null;
        } else f.prog = Math.max(0, f.prog - dt / 5);
      }
      // sync lit state
      if (f.pos) {
        const [x, y, z] = f.pos;
        const cur = this.world.getBlock(x, y, z);
        if (f.burn > 0 && cur === B.furnace) this.world.setBlockRaw(x, y, z, B.furnace_lit);
        else if (f.burn <= 0 && cur === B.furnace_lit) this.world.setBlockRaw(x, y, z, B.furnace);
      }
    }
    if (UI.mode === 'furnace') UI.refreshAll();
  },

  // ---------------- mob spawning ----------------
  trySpawnHostile() {
    if (this.mobs.filter(m => m.def.hostile).length >= 14) return;
    const p = this.player;
    const ang = rand(0, Math.PI * 2), dist = rand(24, 52);
    const x = Math.floor(p.x + Math.cos(ang) * dist) + 0.5;
    const z = Math.floor(p.z + Math.sin(ang) * dist) + 0.5;
    if (!this.world.chunkAt(x, z)) return;
    const y = this.findSpawnY(x, z);
    if (y <= SEA + 1) return;
    // only in darkness
    const sky = this.world.skyAt(x, y, z);
    const dark = this.day < 0.35 || sky < 0.4;
    if (!dark) return;
    const kinds = ['zombie', 'zombie', 'skeleton', 'creeper', 'spider'];
    const kind = kinds[randInt(0, kinds.length - 1)];
    this.mobs.push(new Mob(kind, x, y, z));
  },
  trySpawnPassive(force = false) {
    if (this.mobs.filter(m => !m.def.hostile).length >= 12) return;
    const p = this.player;
    const ang = rand(0, Math.PI * 2), dist = force ? rand(10, 40) : rand(28, 50);
    const x = Math.floor(p.x + Math.cos(ang) * dist) + 0.5;
    const z = Math.floor(p.z + Math.sin(ang) * dist) + 0.5;
    if (!this.world.chunkAt(x, z)) return;
    const y = this.findSpawnY(x, z);
    if (y <= SEA + 1) return;
    const g = this.world.getBlock(x, y - 1, z);
    if (g !== B.grass_block && g !== B.snowy_grass && g !== B.sand) return;
    const kind = ['cow', 'pig', 'sheep', 'chicken'][randInt(0, 3)];
    this.mobs.push(new Mob(kind, x, y, z));
  },

  // ---------------- misc ui ----------------
  msg(text) {
    const el = document.getElementById('msg');
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => el.style.opacity = '0', 2600);
  },
  flashHurt() {
    const el = document.getElementById('hurtflash');
    el.style.transition = 'none'; el.style.opacity = '0.8';
    requestAnimationFrame(() => { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; });
  },

  // ---------------- per-frame ----------------
  frame(t) {
    requestAnimationFrame(tt => this.frame(tt));
    const dt = Math.min(0.05, (t - this.lastFrame) / 1000 || 0.016);
    this.lastFrame = t;
    this.fps = lerp(this.fps || 60, 1 / Math.max(dt, 1e-4), 0.05);
    if (this.state !== 'playing' && this.state !== 'dead' && this.state !== 'paused') return;
    if (!this.world || !this.player) return;

    const p = this.player;
    if (this.state === 'playing') {
      this.timeSec += dt;
      this.stats.playTime += dt;
      this.dayTime = (this.dayTime + dt / DAY_LENGTH) % 1;

      p.update(this, dt, Input);
      this.attackCd -= dt;

      // entities
      for (const m of this.mobs) m.update(this, dt);
      this.mobs = this.mobs.filter(m => !m.dead);
      for (const d of this.drops) d.update(this, dt);
      this.drops = this.drops.filter(d2 => !d2.dead);
      for (const a of this.arrows) a.update(this, dt);
      this.arrows = this.arrows.filter(a => !a.dead);
      for (const o of this.xporbs) o.update(this, dt);
      this.xporbs = this.xporbs.filter(o => !o.dead);
      for (const t2 of this.tnts) t2.update(this, dt);
      this.tnts = this.tnts.filter(t2 => !t2.dead);
      this.particles.update(this.world, dt);

      // despawn far mobs
      for (const m of this.mobs)
        if (dist2(m.x, m.y, m.z, p.x, p.y, p.z) > 80 * 80) m.dead = true;

      // spawn timers
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnT = 1.6; if (this.day < 0.5) this.trySpawnHostile(); else if (Math.random() < 0.25) this.trySpawnHostile(); }
      this.passiveT -= dt;
      if (this.passiveT <= 0) { this.passiveT = 8; if (Math.random() < 0.5) this.trySpawnPassive(); }

      // world ticks
      this.world.runTicks(this);
      this.tickFurnaces(dt);
      // sapling growth
      for (let i = this.growths.length - 1; i >= 0; i--) {
        const g = this.growths[i];
        if (this.timeSec < g.at) continue;
        this.growths.splice(i, 1);
        if (this.world.getBlock(g.x, g.y, g.z) === B.oak_sapling) {
          this.world.setBlock(g.x, g.y, g.z, 0);
          const rng = mulberry32((g.x * 73856093) ^ (g.z * 19349663));
          this.world.tree(g.x, g.y, g.z, 'oak', rng, (x, y, z, id, soft) => {
            if (soft && this.world.getBlock(x, y, z) !== 0) return;
            this.world.setBlock(x, y, z, id);
          });
        }
      }

      // chunk streaming
      this.streamChunks();

      // torch light scan
      this.lightScanT -= dt;
      if (this.lightScanT <= 0) { this.lightScanT = 0.4; this.scanLights(); }

      // ambient music
      this.musicT = (this.musicT ?? 8) - dt;
      if (this.musicT <= 0) { this.musicT = rand(20, 45); Sfx.ambient(this.day < 0.4); }

      // autosave
      this.saveT += dt;
      if (this.saveT > 20) { this.saveT = 0; this.save(); }

      UI.refreshStats(p);
    }

    // ---------------- sky / lighting ----------------
    const th = (this.dayTime - 0.25) * Math.PI * 2; // 0 = sunrise
    const sunY = Math.sin(th);
    const sunDirRaw = [Math.cos(th), sunY, 0.18];
    const sl = Math.hypot(...sunDirRaw);
    const sunDir = sunDirRaw.map(v => v / sl);
    this.day = clamp((sunY + 0.14) / 0.32, 0, 1);
    const dusk = clamp(1 - Math.abs(sunY) / 0.3, 0, 1) * (sunY > -0.15 ? 1 : 0);
    const mixc = (a, b2, tt2) => a.map((v, i) => lerp(v, b2[i], tt2));
    let zenith = mixc([0.012, 0.015, 0.05], [0.32, 0.55, 0.92], this.day);
    let horizon = mixc([0.03, 0.04, 0.1], [0.66, 0.82, 0.96], this.day);
    horizon = mixc(horizon, [0.95, 0.55, 0.28], dusk * 0.65);
    const underwater = p.headInWater(this.world);
    let fogColor = underwater ? [0.1, 0.25, 0.5] : horizon;
    // smooth sprint FOV kick
    this._fov = lerp(this._fov || 72, underwater ? 66 : p.sprinting ? 80 : 72, 0.15);

    // dynamic lights (torches etc)
    Renderer.setLights(this._lights || []);

    // ---------------- build entity vertex buffer ----------------
    const entV = [];
    for (const m of this.mobs) m.emit(entV, this);
    for (const d of this.drops) d.emit(entV, this);
    for (const a of this.arrows) a.emit(entV, this);
    for (const o of this.xporbs) o.emit(entV, this);
    for (const t2 of this.tnts) t2.emit(entV, this);
    const partV = [];
    this.particles.emit(partV, p, this.world);

    // crack overlay
    let crackV = null;
    if (p.mining && p.mining.total > 0.1) {
      const stage = clamp(Math.floor(p.mining.progress / p.mining.total * 4), 0, 3);
      crackV = [];
      const ti = TileIdx['crack' + stage];
      const { x, y, z } = p.mining;
      for (let fi = 0; fi < 6; fi++) {
        const f = FACES[fi];
        const vtx = [];
        for (let i = 0; i < 4; i++) {
          const c = f.c[i];
          const [u, v] = tileUVc(ti, UVQ[i][0], UVQ[i][1]);
          vtx.push([x + c[0], y + c[1], z + c[2], u, v, 1]);
        }
        pushQuad(crackV, vtx);
      }
    }

    // process meshing queue
    this.meshDirtyChunks();

    // camera with bob + sneak
    const bobA = (this.state === 'playing' && p.onGround) ? Math.sin(p.bob * 6) * 0.05 : 0;
    const eyeH = p.sneaking ? p.eye - 0.3 : p.eye;

    // first-person held item / arm
    const handV = [];
    if (this.state === 'playing' && !p.dead && !Input.uiOpen) {
      const look = p.lookDir();
      const rt = [Math.cos(p.yaw), 0, -Math.sin(p.yaw)];
      const heldS = this.inv.held();
      // swing: mining loops, single swing decays
      let dip = 0;
      if (p.mining) dip = Math.abs(Math.sin(this.timeSec * 9)) * 0.16;
      else if (p.swing > 0) dip = Math.sin((0.25 - p.swing) / 0.25 * Math.PI) * 0.16;
      if (p.eatT > 0) dip = Math.abs(Math.sin(this.timeSec * 12)) * 0.1;
      const pull = p.bowCharge ? p.bowCharge * 0.18 : 0;
      const hbx = Math.sin(p.bob * 6) * 0.012;
      const hl = Math.max(0.35, this.world.skyAt(p.x, p.y + 1.5, p.z));
      const hx = p.x + look[0] * (0.5 - dip * 0.6 - pull) + rt[0] * (0.34 - pull) + rt[0] * hbx;
      const hy = p.y + eyeH + bobA - 0.34 - dip * 0.5 + look[1] * (0.5 - pull);
      const hz = p.z + look[2] * (0.5 - dip * 0.6 - pull) + rt[2] * (0.34 - pull) + rt[2] * hbx;
      if (heldS && heldS.id < 256) {
        const b = Blocks[heldS.id];
        if (b.tiles) addBox(handV, hx, hy - 0.12, hz, 0.13, 0.13, 0.13, p.yaw + 0.5, b.tiles, hl);
      } else if (heldS) {
        const icon = Items[heldS.id].icon ?? TileIdx.white;
        addSprite(handV, hx, hy - 0.2, hz, 0.21, p.yaw + Math.PI / 2 + 0.35, icon, hl);
      } else {
        // bare arm
        emitEntityBox(handV, hx + look[0] * 0.08 + rt[0] * 0.05, hy - 0.16, hz + look[2] * 0.08 + rt[2] * 0.05,
          0.045, 0.15, 0.045, p.yaw + 0.5, { all: TileIdx.skin }, hl);
      }
    }
    Renderer.frame({
      world: this.world,
      cam: { x: p.x, y: p.y + eyeH + bobA, z: p.z, pitch: p.pitch, yaw: p.yaw },
      day: this.day, sunDir, zenith, horizon, fogColor,
      time: this.timeSec,
      entVerts: entV.length ? new Float32Array(entV) : null,
      partVerts: partV.length ? new Float32Array(partV) : null,
      handVerts: handV.length ? new Float32Array(handV) : null,
      crackVerts: crackV && crackV.length ? new Float32Array(crackV) : null,
      outline: this.target ? [this.target.x, this.target.y, this.target.z] : null,
      underwater,
      fov: this._fov,
    });

    if (this.debugOn) {
      document.getElementById('debug').textContent =
        `fps ${this.fps.toFixed(0)}\n` +
        `xyz ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}\n` +
        `biome ${this.world.biomeAt(p.x, p.z)}  time ${(this.dayTime * 24).toFixed(1)}h\n` +
        `chunks ${this.world.chunks.size}  mobs ${this.mobs.length}  drops ${this.drops.length}`;
    }
  },

  streamChunks() {
    const p = this.player;
    const cx0 = Math.floor(p.x / CHUNK), cz0 = Math.floor(p.z / CHUNK);
    // load 1-2 chunks per frame max
    let budget = 2;
    for (let r = 0; r <= VIEW_R && budget > 0; r++) {
      for (let dx = -r; dx <= r && budget > 0; dx++) for (let dz = -r; dz <= r && budget > 0; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const key = CKEY(cx0 + dx, cz0 + dz);
        const c = this.world.chunks.get(key);
        if (!c || !c.populated) { this.world.ensureChunk(cx0 + dx, cz0 + dz); budget--; }
      }
    }
    // unload far chunks
    if ((this._unloadT = (this._unloadT || 0) + 1) % 120 === 0) {
      for (const [key, c] of this.world.chunks) {
        const d = Math.max(Math.abs(c.cx - cx0), Math.abs(c.cz - cz0));
        if (d > VIEW_R + 3) {
          Renderer.dropChunk(c);
          this.world.chunks.delete(key);
        }
      }
    }
  },

  meshDirtyChunks() {
    const p = this.player;
    const cx0 = Math.floor(p.x / CHUNK), cz0 = Math.floor(p.z / CHUNK);
    const dirty = [];
    for (const c of this.world.chunks.values())
      if (c.dirty && c.populated) dirty.push(c);
    dirty.sort((a, b2) => ((a.cx - cx0) ** 2 + (a.cz - cz0) ** 2) - ((b2.cx - cx0) ** 2 + (b2.cz - cz0) ** 2));
    let budget = 2;
    for (const c of dirty) {
      if (budget-- <= 0) break;
      c.dirty = false;
      Renderer.uploadChunk(c, meshChunk(this.world, c));
    }
  },

  scanLights() {
    const p = this.player;
    const lights = [];
    const R = 14;
    const x0 = Math.floor(p.x - R), x1 = Math.floor(p.x + R);
    const y0 = Math.max(0, Math.floor(p.y - 10)), y1 = Math.min(WORLD_H - 1, Math.floor(p.y + 12));
    const z0 = Math.floor(p.z - R), z1 = Math.floor(p.z + R);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const c = this.world.chunks.get(CKEY(x >> 4, z >> 4));
      if (!c) continue;
      for (let y = y0; y <= y1; y++) {
        const id = c.get(x & 15, y, z & 15);
        if (id && Blocks[id].light > 0) {
          lights.push([x + 0.5, y + 0.5, z + 0.5, Blocks[id].light]);
          if (lights.length >= 32) { this._lights = lights; return; }
        }
      }
    }
    this._lights = lights;
  },
};

window.addEventListener('DOMContentLoaded', () => {
  try { Game.boot(); }
  catch (e) {
    document.body.innerHTML = '<div style="color:#fff;font-family:monospace;padding:30px">Failed to start: ' + e.message + '<br>This game needs a browser with WebGL2 (Chrome, Edge, Firefox).</div>';
    console.error(e);
  }
});
