'use strict';
// ---------------------------------------------------------------- sounds (WebAudio, all synthesized)
const Sfx = {
  ctx: null, master: null,
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  noiseBuf() {
    if (!this._nb) {
      const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._nb = b;
    }
    return this._nb;
  },
  noise(dur, freq, vol, q = 1) {
    try {
      this.ensure();
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf();
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + dur);
    } catch (e) {}
  },
  tone(dur, f0, f1, vol, type = 'square') {
    try {
      this.ensure();
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  },
  dig(blockId) {
    const b = Blocks[blockId];
    if (!b) return;
    if (b.tool === T_PICK || blockId === B.stone) this.noise(0.09, 900, 0.35, 2);
    else if (b.tool === T_AXE) this.noise(0.09, 500, 0.35, 1.5);
    else if (b.rt === RT_CROSS || b.rt === RT_LEAVES) this.noise(0.08, 2200, 0.2, 1);
    else this.noise(0.09, 700, 0.3, 1);
  },
  breakBlk(blockId) { this.dig(blockId); this.noise(0.16, 500, 0.4, 1); },
  place() { this.noise(0.1, 800, 0.35, 2); },
  pop() { this.tone(0.09, 500, 1100, 0.22, 'sine'); },
  click() { this.tone(0.04, 700, 500, 0.15, 'square'); },
  hurt() { this.tone(0.18, 300, 130, 0.35, 'sawtooth'); },
  eat() { this.noise(0.07, 1400, 0.3, 1); },
  burp() { this.tone(0.25, 200, 70, 0.3, 'sawtooth'); },
  bow() { this.tone(0.12, 400, 900, 0.2, 'sine'); this.noise(0.06, 2000, 0.15, 1); },
  thud() { this.noise(0.08, 300, 0.3, 1.5); },
  fuse() { this.noise(1.4, 3500, 0.25, 3); },
  explosion() { this.noise(0.8, 120, 0.9, 0.7); this.tone(0.5, 90, 30, 0.5, 'sawtooth'); },
  splash() { this.noise(0.3, 1200, 0.3, 0.8); },
  levelup() { this.tone(0.3, 500, 1000, 0.2, 'sine'); },
  mobHurt(kind) {
    if (kind === 'zombie') this.tone(0.25, 180, 90, 0.3, 'sawtooth');
    else if (kind === 'skeleton') this.noise(0.15, 1500, 0.3, 4);
    else if (kind === 'creeper') this.noise(0.15, 900, 0.3, 2);
    else if (kind === 'spider') this.noise(0.18, 2500, 0.28, 3);
    else this.tone(0.22, 500, 300, 0.28, 'triangle');
  },
  step(blockId) { this.noise(0.05, 600, 0.08, 1); },
};

// ---------------------------------------------------------------- inventory model
class Inventory {
  constructor() {
    this.slots = new Array(36).fill(null);  // 0-8 hotbar
    this.sel = 0;
    this.cursor = null;                      // stack on mouse in UI
  }
  held() { return this.slots[this.sel]; }
  scrollHotbar(d) { this.sel = (this.sel + d + 9) % 9; UI.refreshHotbar(); UI.showItemName(); }
  give(id, count) {
    // merge into existing stacks first
    for (let pass = 0; pass < 2; pass++)
      for (let i = 0; i < 36; i++) {
        const s = this.slots[i];
        if (pass === 0) {
          if (s && s.id === id && !itemDef(id).durability) {
            const room = maxStack(id) - s.count;
            const take = Math.min(room, count);
            s.count += take; count -= take;
          }
        } else if (!s && count > 0) {
          const take = Math.min(maxStack(id), count);
          this.slots[i] = { id, count: take };
          if (itemDef(id).durability) this.slots[i].dur = itemDef(id).durability;
          count -= take;
        }
        if (count === 0) { UI.refreshHotbar(); UI.refreshAll(); return 0; }
      }
    UI.refreshHotbar(); UI.refreshAll();
    return count;
  }
  consumeHeld(n = 1) {
    const s = this.slots[this.sel];
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.slots[this.sel] = null;
    UI.refreshHotbar();
  }
  damageHeld(game) {
    const s = this.slots[this.sel];
    if (!s || !s.dur) return;
    s.dur--;
    if (s.dur <= 0) { this.slots[this.sel] = null; Sfx.thud(); game.msg('Your tool broke!'); }
    UI.refreshHotbar();
  }
  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }
  serialize() { return { slots: this.slots, sel: this.sel }; }
  load(d) { if (d) { this.slots = d.slots || this.slots; this.sel = d.sel || 0; } }
}

// ---------------------------------------------------------------- crafting logic
function matchShaped(grid, gw, r) {
  // grid: array of ids (0 = empty), gw = 2 or 3
  const pat = r.pat;
  const ph = pat.length, pw = Math.max(...pat.map(x => x.length));
  if (pw > gw || ph > gw) return false;
  // bounding box of grid content
  let minX = 9, minY = 9, maxX = -1, maxY = -1;
  for (let y = 0; y < gw; y++) for (let x = 0; x < gw; x++)
    if (grid[y * gw + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  if (maxX < 0) return false;
  if (maxX - minX + 1 !== pw || maxY - minY + 1 !== ph) return false;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const want = (pat[y] && pat[y][x]) || 0;
    const have = grid[(minY + y) * gw + (minX + x)] || 0;
    if (want !== have) return false;
  }
  return true;
}
function matchRecipe(gridSlots, gw) {
  const grid = gridSlots.map(s => s ? s.id : 0);
  const present = grid.filter(x => x).sort((a, b2) => a - b2);
  for (const r of Recipes) {
    if (r.pat) { if (matchShaped(grid, gw, r)) return r; }
    else if (r.ids) {
      if (present.length === r.ids.length && present.every((v, i) => v === r.ids[i])) return r;
    }
  }
  return null;
}

// ---------------------------------------------------------------- DOM UI
const UI = {
  game: null,
  mode: null,               // 'inv' | 'table' | 'furnace' | 'chest'
  craftSlots: [], craftW: 2,
  furnRef: null,
  chestRef: null,
  slotEls: {},              // key -> {el, canvas, cnt, dur}

  $(id) { return document.getElementById(id); },
  init(game) {
    this.game = game;
    // hotbar
    const hb = this.$('hotbar');
    this.hotEls = [];
    for (let i = 0; i < 9; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      const cv = document.createElement('canvas');
      cv.width = cv.height = 36; cv.className = 'pixel';
      const cnt = document.createElement('span'); cnt.className = 'cnt';
      const dur = document.createElement('div'); dur.className = 'dur';
      el.append(cv, cnt, dur);
      hb.appendChild(el);
      this.hotEls.push({ el, cv: cv.getContext('2d'), cnt, dur });
    }
    // inventory grids
    this.mainEls = this.buildGrid(this.$('maingrid'), 27, (i, e) => this.slotClick(9 + i, 'inv', e));
    this.barEls = this.buildGrid(this.$('bargrid'), 9, (i, e) => this.slotClick(i, 'inv', e));
    document.addEventListener('contextmenu', e => { if (Input.uiOpen) e.preventDefault(); });
    document.addEventListener('mousemove', e => {
      const g = this.$('ghost');
      g.style.left = (e.clientX + 6) + 'px';
      g.style.top = (e.clientY + 6) + 'px';
      const tip = this.$('tooltip');
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top = (e.clientY - 26) + 'px';
    });
    this.$('wininv').addEventListener('mousedown', e => {
      if (e.target === this.$('wininv')) { } // click outside panel: ignore
    });
  },
  buildGrid(container, n, onClick, cls) {
    container.innerHTML = '';
    const els = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'islot';
      const cv = document.createElement('canvas');
      cv.width = cv.height = 36; cv.className = 'pixel';
      const cnt = document.createElement('span'); cnt.className = 'cnt';
      const dur = document.createElement('div'); dur.className = 'dur';
      el.append(cv, cnt, dur);
      el.addEventListener('mousedown', e => { e.preventDefault(); onClick(i, e); });
      el.addEventListener('mouseenter', () => this.hover(container, i));
      el.addEventListener('mouseleave', () => this.$('tooltip').style.display = 'none');
      container.appendChild(el);
      els.push({ el, cv: cv.getContext('2d'), cnt, dur });
    }
    return els;
  },
  hover(container, i) {
    let s = null;
    if (container === this.$('maingrid')) s = this.game.inv.slots[9 + i];
    else if (container === this.$('bargrid')) s = this.game.inv.slots[i];
    else if (container === this.$('craftgrid')) s = this.craftSlots[i];
    else if (container === this.$('chestgrid')) s = this.chestRef ? this.chestRef[i] : null;
    const tip = this.$('tooltip');
    if (s) { tip.textContent = itemLabel(s.id); tip.style.display = 'block'; }
    else tip.style.display = 'none';
  },

  drawSlot(e, s, selected) {
    e.cv.clearRect(0, 0, 36, 36);
    if (s) drawItemIcon(e.cv, s.id, 36);
    e.cnt.textContent = s && s.count > 1 ? s.count : '';
    if (s && s.dur !== undefined && s.dur < itemDef(s.id).durability) {
      const f = s.dur / itemDef(s.id).durability;
      e.dur.style.width = (f * 38) + 'px';
      e.dur.style.background = f > 0.5 ? '#3f3' : f > 0.2 ? '#ff3' : '#f33';
      e.dur.style.display = 'block';
    } else e.dur.style.display = 'none';
  },
  refreshHotbar() {
    const inv = this.game.inv;
    for (let i = 0; i < 9; i++) {
      const e = this.hotEls[i];
      e.el.classList.toggle('sel', i === inv.sel);
      this.drawSlot(e, inv.slots[i]);
    }
  },
  refreshAll() {
    if (!Input.uiOpen) return;
    const inv = this.game.inv;
    for (let i = 0; i < 27; i++) this.drawSlot(this.mainEls[i], inv.slots[9 + i]);
    for (let i = 0; i < 9; i++) this.drawSlot(this.barEls[i], inv.slots[i]);
    if (this.craftEls) for (let i = 0; i < this.craftSlots.length; i++) this.drawSlot(this.craftEls[i], this.craftSlots[i]);
    if (this.outEl) {
      const r = matchRecipe(this.craftSlots, this.craftW);
      this.craftResult = r;
      this.drawSlot(this.outEl, r ? { id: r.outId, count: r.count } : null);
    }
    if (this.mode === 'furnace' && this.furnRef) {
      const f = this.furnRef;
      this.drawSlot(this.furnInEl, f.in);
      this.drawSlot(this.furnFuelEl, f.fuel);
      this.drawSlot(this.furnOutEl, f.out);
      this.$('fireicon').classList.toggle('lit', f.burn > 0);
      this.$('furnprog').firstElementChild.style.width = Math.floor(f.prog * 100) + '%';
    }
    if (this.mode === 'chest' && this.chestEls)
      for (let i = 0; i < 27; i++) this.drawSlot(this.chestEls[i], this.chestRef[i]);
    // ghost
    const g = this.$('ghost');
    if (inv.cursor) {
      g.style.display = 'block';
      drawItemIcon(g.querySelector('canvas').getContext('2d'), inv.cursor.id, 16);
      g.querySelector('.cnt').textContent = inv.cursor.count > 1 ? inv.cursor.count : '';
    } else g.style.display = 'none';
  },

  open(mode, ref) {
    this.mode = mode;
    Input.uiOpen = true;
    this.$('wininv').classList.remove('hidden');
    this.$('craftzone').classList.toggle('hidden', mode === 'furnace' || mode === 'chest');
    this.$('furnzone').classList.toggle('hidden', mode !== 'furnace');
    const titles = { inv: 'Crafting', table: 'Crafting Table', furnace: 'Furnace', chest: 'Chest' };
    this.$('invtitle').textContent = titles[mode];
    let chestGrid = this.$('chestgrid');
    if (chestGrid) chestGrid.remove();
    this.chestEls = null;
    if (mode === 'inv' || mode === 'table') {
      this.craftW = mode === 'inv' ? 2 : 3;
      this.craftSlots = new Array(this.craftW * this.craftW).fill(null);
      const cg = this.$('craftgrid');
      cg.style.gridTemplateColumns = `repeat(${this.craftW},46px)`;
      this.craftEls = this.buildGrid(cg, this.craftW * this.craftW, (i, e) => this.slotClick(i, 'craft', e));
      const co = this.$('craftout');
      this.outEl = this.buildGrid(co, 1, () => this.takeCraft())[0];
    } else {
      this.craftEls = null; this.outEl = null; this.craftSlots = [];
    }
    if (mode === 'furnace') {
      this.furnRef = ref;
      this.furnInEl = this.buildGrid(this.$('furnin'), 1, (i, e) => this.slotClick(0, 'furnin', e))[0];
      this.furnFuelEl = this.buildGrid(this.$('furnfuel'), 1, (i, e) => this.slotClick(0, 'furnfuel', e))[0];
      this.furnOutEl = this.buildGrid(this.$('furnout'), 1, (i, e) => this.slotClick(0, 'furnout', e))[0];
    }
    this.game._uiT = performance.now();
    if (mode === 'chest') {
      this.chestRef = ref;
      const cg = document.createElement('div');
      cg.id = 'chestgrid'; cg.className = 'grid';
      cg.style.marginBottom = '10px';
      const mainTitle = this.$('invpanel').querySelectorAll('h3')[1];
      this.$('invpanel').insertBefore(cg, mainTitle);
      this.chestEls = this.buildGrid(cg, 27, (i, e) => this.slotClick(i, 'chest', e));
    }
    document.exitPointerLock();
    this.refreshAll();
  },
  close() {
    if (!Input.uiOpen) return;
    Input.uiOpen = false;
    this.$('wininv').classList.add('hidden');
    this.$('tooltip').style.display = 'none';
    const inv = this.game.inv;
    // return crafting grid + cursor items
    for (let i = 0; i < this.craftSlots.length; i++) {
      const s = this.craftSlots[i];
      if (s) { const left = inv.give(s.id, s.count); if (left) this.game.dropFromPlayer(s.id, left); }
      this.craftSlots[i] = null;
    }
    if (inv.cursor) {
      const left = inv.give(inv.cursor.id, inv.cursor.count);
      if (left) this.game.dropFromPlayer(inv.cursor.id, left);
      inv.cursor = null;
    }
    this.mode = null; this.furnRef = null; this.chestRef = null;
    this.$('ghost').style.display = 'none';
    if (this.game.state === 'playing') this.game.lockPointer();
  },

  // slot interaction: area = inv | craft | furnin | furnfuel | furnout | chest
  slotAccess(area, i) {
    const inv = this.game.inv;
    if (area === 'inv') return { get: () => inv.slots[i], set: v => inv.slots[i] = v };
    if (area === 'craft') return { get: () => this.craftSlots[i], set: v => this.craftSlots[i] = v };
    if (area === 'chest') return { get: () => this.chestRef[i], set: v => this.chestRef[i] = v || null };
    if (area === 'furnin') return { get: () => this.furnRef.in, set: v => this.furnRef.in = v };
    if (area === 'furnfuel') return { get: () => this.furnRef.fuel, set: v => this.furnRef.fuel = v };
    if (area === 'furnout') return { get: () => this.furnRef.out, set: v => this.furnRef.out = v, takeOnly: true };
    return null;
  },
  slotClick(i, area, e) {
    const inv = this.game.inv;
    const acc = this.slotAccess(area, i);
    if (!acc) return;
    const s = acc.get();
    const right = e && e.button === 2;
    const shift = e && e.shiftKey;
    Sfx.click();
    if (shift && s && area === 'inv') {
      // quick-move between hotbar and main
      const from = i, isHot = from < 9;
      acc.set(null);
      let left = 0;
      // try to place into other section
      const targetRange = isHot ? [9, 36] : [0, 9];
      left = this.giveRange(s.id, s.count, targetRange[0], targetRange[1], s.dur);
      if (left) acc.set({ id: s.id, count: left, ...(s.dur !== undefined ? { dur: s.dur } : {}) });
      this.refreshAll(); this.refreshHotbar();
      return;
    }
    if (!inv.cursor) {
      if (!s) return;
      if (right && !acc.takeOnly && s.count > 1) {
        const half = Math.ceil(s.count / 2);
        inv.cursor = { id: s.id, count: half, ...(s.dur !== undefined ? { dur: s.dur } : {}) };
        s.count -= half;
      } else {
        inv.cursor = s;
        acc.set(null);
      }
    } else {
      if (acc.takeOnly) {
        if (s && s.id === inv.cursor.id && inv.cursor.count + s.count <= maxStack(s.id)) {
          inv.cursor.count += s.count; acc.set(null);
        }
      } else if (!s) {
        if (right) {
          acc.set({ id: inv.cursor.id, count: 1, ...(inv.cursor.dur !== undefined ? { dur: inv.cursor.dur } : {}) });
          inv.cursor.count--;
          if (inv.cursor.count <= 0) inv.cursor = null;
        } else { acc.set(inv.cursor); inv.cursor = null; }
      } else if (s.id === inv.cursor.id && s.dur === undefined) {
        const room = maxStack(s.id) - s.count;
        const n = right ? Math.min(1, room) : Math.min(room, inv.cursor.count);
        s.count += n; inv.cursor.count -= n;
        if (inv.cursor.count <= 0) inv.cursor = null;
      } else {
        const tmp = s; acc.set(inv.cursor); inv.cursor = tmp;
      }
    }
    this.refreshAll(); this.refreshHotbar();
  },
  giveRange(id, count, a, b, dur) {
    const inv = this.game.inv;
    for (let pass = 0; pass < 2; pass++)
      for (let i = a; i < b && count > 0; i++) {
        const s = inv.slots[i];
        if (pass === 0 && s && s.id === id && dur === undefined) {
          const take = Math.min(maxStack(id) - s.count, count);
          s.count += take; count -= take;
        } else if (pass === 1 && !s) {
          inv.slots[i] = { id, count, ...(dur !== undefined ? { dur } : {}) };
          count = 0;
        }
      }
    return count;
  },
  takeCraft() {
    const inv = this.game.inv;
    const r = this.craftResult;
    if (!r) return;
    if (inv.cursor && (inv.cursor.id !== r.outId || inv.cursor.count + r.count > maxStack(r.outId))) return;
    // consume one of each input
    for (let i = 0; i < this.craftSlots.length; i++) {
      const s = this.craftSlots[i];
      if (s) { s.count--; if (s.count <= 0) this.craftSlots[i] = null; }
    }
    if (inv.cursor) inv.cursor.count += r.count;
    else {
      inv.cursor = { id: r.outId, count: r.count };
      if (itemDef(r.outId).durability) inv.cursor.dur = itemDef(r.outId).durability;
    }
    Sfx.pop();
    this.game.stats.crafted++;
    this.refreshAll(); this.refreshHotbar();
  },

  // ---------------- HUD ----------------
  heartsHtml(hp, max, full, empty, color) {
    let s = '';
    const n = Math.ceil(max / 2);
    for (let i = 0; i < n; i++) {
      const v = hp - i * 2;
      if (v >= 2) s += `<span style="color:${color}">${full}</span>`;
      else if (v === 1) s += `<span style="color:${color};opacity:.9">${full}</span><span style="color:#333;margin-left:-1em">${empty}</span>`.replace('</span><span', '</span><span'); // half ~ approximated
      else s += `<span style="color:#3a3a3a">${full}</span>`;
    }
    return s;
  },
  refreshStats(p) {
    let h = '';
    for (let i = 0; i < 10; i++) {
      const v = p.hp - i * 2;
      h += `<span style="color:${v >= 2 ? '#e53935' : v === 1 ? '#a33' : '#3a3a3a'}">❤</span>`;
    }
    this.$('hearts').innerHTML = h;
    let f = '';
    for (let i = 9; i >= 0; i--) {
      const v = p.hunger - i * 2;
      f += `<span style="color:${v >= 2 ? '#c98d3c' : v === 1 ? '#8a6127' : '#3a3a3a'}">🍗</span>`;
    }
    this.$('hunger').innerHTML = f;
    const air = this.$('air');
    if (p.headInWater(this.game.world)) {
      let a = '';
      for (let i = 0; i < p.maxAir; i++) a += `<span style="color:${i < p.air ? '#4fc3f7' : '#234'}">●</span>`;
      air.innerHTML = a;
    } else air.innerHTML = '';
    this.$('vignette').style.opacity = p.hp <= 6 ? '1' : '0';
  },
  showItemName() {
    const s = this.game.inv.held();
    const el = this.$('itemname');
    el.textContent = s ? itemLabel(s.id) : '';
    el.style.opacity = '1';
    clearTimeout(this._nameT);
    this._nameT = setTimeout(() => el.style.opacity = '0', 1500);
  },
};
