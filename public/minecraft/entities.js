'use strict';
// ---------------------------------------------------------------- entities: drops, mobs, arrows, particles

let ENT_ID = 1;

class Entity {
  constructor(x, y, z) {
    this.id = ENT_ID++;
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.w = 0.3; this.h = 0.9;      // half-width, full height
    this.onGround = false;
    this.dead = false;
    this.age = 0;
    this.inWater = false;
  }
  physics(world, dt, gravity = 24) {
    this.inWater = world.getBlock(this.x, this.y + this.h * 0.5, this.z) === B.water;
    const g = this.inWater ? gravity * 0.3 : gravity;
    this.vy -= g * dt;
    if (this.inWater) { this.vy *= 0.92; this.vx *= 0.94; this.vz *= 0.94; }
    const move = (dx, dy, dz) => {
      // axis-by-axis sweep
      if (dx) {
        const nx = this.x + dx;
        if (!world.boxCollides(nx - this.w, this.y, this.z - this.w, nx + this.w, this.y + this.h, this.z + this.w)) this.x = nx;
        else this.vx = 0;
      }
      if (dz) {
        const nz = this.z + dz;
        if (!world.boxCollides(this.x - this.w, this.y, nz - this.w, this.x + this.w, this.y + this.h, nz + this.w)) this.z = nz;
        else this.vz = 0;
      }
      if (dy) {
        const ny = this.y + dy;
        if (!world.boxCollides(this.x - this.w, ny, this.z - this.w, this.x + this.w, ny + this.h, this.z + this.w)) {
          this.y = ny; this.onGround = false;
        } else {
          if (dy < 0) this.onGround = true;
          this.vy = 0;
        }
      }
    };
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vx), Math.abs(this.vy), Math.abs(this.vz)) * dt / 0.4));
    for (let i = 0; i < steps; i++)
      move(this.vx * dt / steps, this.vy * dt / steps, this.vz * dt / steps);
  }
}

// ---------------------------------------------------------------- item drop
class Drop extends Entity {
  constructor(x, y, z, item, count) {
    super(x, y, z);
    this.item = item; this.count = count;
    this.w = 0.12; this.h = 0.24;
    this.vx = rand(-2, 2); this.vy = rand(2, 4.5); this.vz = rand(-2, 2);
    this.pickupDelay = 0.6;
  }
  update(game, dt) {
    this.age += dt;
    this.pickupDelay -= dt;
    this.vx *= 0.96; this.vz *= 0.96;
    this.physics(game.world, dt, 18);
    if (this.y < -10) this.dead = true;
    if (this.age > 300) this.dead = true;
    // magnet + pickup
    const p = game.player;
    const d2 = dist2(this.x, this.y, this.z, p.x, p.y + 0.8, p.z);
    if (this.pickupDelay <= 0 && !p.dead) {
      if (d2 < 4) {
        const pull = 4.5;
        this.vx += (p.x - this.x) * pull * dt * 3;
        this.vy += (p.y + 0.6 - this.y) * pull * dt * 3;
        this.vz += (p.z - this.z) * pull * dt * 3;
      }
      if (d2 < 1.1) {
        const left = game.giveItem(this.item, this.count);
        if (left === 0) { this.dead = true; Sfx.pop(); }
        else this.count = left;
      }
    }
  }
  emit(verts, game) {
    const spin = this.age * 1.4;
    const bob = Math.sin(this.age * 2.2) * 0.06 + 0.12;
    const l = Math.max(0.25, game.world.skyAt(this.x, this.y + 0.5, this.z));
    if (this.item < 256) {
      const b = Blocks[this.item];
      if (b && b.tiles) { addBox(verts, this.x, this.y + bob, this.z, 0.14, 0.14, 0.14, spin, b.tiles, l); return; }
    }
    // flat sprite item — two crossed quads
    const t = this.item >= 256 ? (Items[this.item].icon ?? TileIdx.white) : TileIdx.white;
    addSprite(verts, this.x, this.y + bob, this.z, 0.16, spin, t, l);
  }
}

// ---------------------------------------------------------------- primed tnt
class Tnt extends Entity {
  constructor(x, y, z, fuse = 3) {
    super(x, y, z);
    this.w = 0.45; this.h = 0.9;
    this.fuse = fuse;
    this.vy = 3;
  }
  update(game, dt) {
    this.age += dt;
    this.fuse -= dt;
    this.vx *= 0.95; this.vz *= 0.95;
    this.physics(game.world, dt, 20);
    if (this.fuse <= 0) {
      this.dead = true;
      game.explode(this.x, this.y + 0.5, this.z, 3.4, 30);
    }
  }
  emit(verts, game) {
    const flash = Math.floor(this.fuse * 5) % 2 === 0 ? 1.9 : Math.max(0.4, game.world.skyAt(this.x, this.y + 1, this.z));
    addBox(verts, this.x, this.y, this.z, 0.48, 0.45, 0.48, 0, Blocks[B.tnt].tiles, flash);
  }
}

// ---------------------------------------------------------------- xp orb
class XpOrb extends Entity {
  constructor(x, y, z, value) {
    super(x, y, z);
    this.value = value;
    this.w = 0.1; this.h = 0.2;
    this.vx = rand(-1.5, 1.5); this.vy = rand(1.5, 3.5); this.vz = rand(-1.5, 1.5);
  }
  update(game, dt) {
    this.age += dt;
    if (this.age > 120) { this.dead = true; return; }
    this.vx *= 0.96; this.vz *= 0.96;
    this.physics(game.world, dt, 16);
    if (this.y < -10) this.dead = true;
    const p = game.player;
    if (p.dead) return;
    const d2 = dist2(this.x, this.y, this.z, p.x, p.y + 0.8, p.z);
    if (d2 < 7) {
      this.vx += (p.x - this.x) * dt * 22;
      this.vy += (p.y + 0.7 - this.y) * dt * 22;
      this.vz += (p.z - this.z) * dt * 22;
    }
    if (d2 < 0.8) {
      this.dead = true;
      p.xp += this.value;
      Sfx.orb();
      UI.refreshXp(p);
    }
  }
  emit(verts, game) {
    const l = 1.1 + Math.sin(this.age * 6) * 0.2;
    addSprite(verts, this.x, this.y + Math.sin(this.age * 3) * 0.04 + 0.05, this.z,
      0.09, game.player.yaw, TileIdx.xp, l);
  }
}

// ---------------------------------------------------------------- arrow
class Arrow extends Entity {
  constructor(x, y, z, vx, vy, vz, fromPlayer = false) {
    super(x, y, z);
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.w = 0.05; this.h = 0.1;
    this.fromPlayer = fromPlayer;
    this.stuck = false;
  }
  update(game, dt) {
    this.age += dt;
    if (this.age > 12) { this.dead = true; return; }
    if (this.stuck) return;
    this.vy -= 14 * dt;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt, nz = this.z + this.vz * dt;
    const id = game.world.getBlock(nx, ny, nz);
    if (id && Blocks[id].solid) { this.stuck = true; Sfx.thud(); return; }
    this.x = nx; this.y = ny; this.z = nz;
    // hit checks
    if (!this.fromPlayer) {
      const p = game.player;
      if (!p.dead && Math.abs(this.x - p.x) < 0.45 && Math.abs(this.z - p.z) < 0.45 &&
          this.y > p.y && this.y < p.y + 1.8) {
        p.hurt(game, 3, this.vx * 0.4, this.vz * 0.4);
        this.dead = true;
      }
    } else {
      for (const e of game.mobs) {
        if (Math.abs(this.x - e.x) < e.w + 0.2 && Math.abs(this.z - e.z) < e.w + 0.2 &&
            this.y > e.y && this.y < e.y + e.h) {
          e.hurt(game, 5, this.vx * 0.3, this.vz * 0.3);
          this.dead = true;
          break;
        }
      }
    }
  }
  emit(verts, game) {
    const l = Math.max(0.3, game.world.skyAt(this.x, this.y, this.z));
    const yaw = Math.atan2(this.vx, this.vz);
    addSprite(verts, this.x, this.y - 0.08, this.z, 0.22, yaw, Items[I.arrow].icon, l);
  }
}

// ---------------------------------------------------------------- fireball
// Everything the mobs throw. `kind` picks what it does on impact; the older
// `power` flag still means "ghast fireball" so the dragon fight is unchanged.
const SHOT = {
  bolt:   { dmg: 5,  size: 0.16, tile: 'fireball', trail: 0.5,  gravity: 0 },
  fire:   { dmg: 0,  size: 0.40, tile: 'fireball', trail: 0.5,  gravity: 0 },
  wind:   { dmg: 1,  size: 0.26, tile: 'white',    trail: 0.7,  gravity: 0,   knock: 16, radius: 2.4 },
  potion: { dmg: 6,  size: 0.22, tile: 'poppy',    trail: 0.25, gravity: 9,   radius: 2.6 },
  bullet: { dmg: 4,  size: 0.18, tile: 'purpur_block',   trail: 0.3,  gravity: 0 },
  snow:   { dmg: 2,  size: 0.18, tile: 'white',    trail: 0.15, gravity: 6,   hitsMobs: true },
};
class Fireball extends Entity {
  constructor(x, y, z, vx, vy, vz, power, kind) {
    super(x, y, z);
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.w = 0.15; this.h = 0.3;
    this.power = power;           // 0 = blaze bolt, 1 = ghast fireball
    this.kind = kind || (power ? 'fire' : 'bolt');
    this.spec = SHOT[this.kind] || SHOT.bolt;
  }
  update(game, dt) {
    this.age += dt;
    if (this.age > 10) { this.dead = true; return; }
    const sp = this.spec;
    if (sp.gravity) this.vy -= sp.gravity * dt;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt, nz = this.z + this.vz * dt;
    const id = game.world.getBlock(nx, ny, nz);
    const p = game.player;
    let hitPlayer = !sp.hitsMobs && !p.dead && Math.abs(nx - p.x) < 0.55 && Math.abs(nz - p.z) < 0.55 &&
      ny > p.y - 0.3 && ny < p.y + 2;
    // splash shots burst as they come alongside you, not only where they land
    if (sp.radius && !sp.hitsMobs && !p.dead &&
        dist2(nx, ny, nz, p.x, p.y + 1, p.z) < sp.radius * sp.radius * 0.36) hitPlayer = true;
    // a snow golem's snowballs are aimed the other way
    let hitMob = null;
    if (sp.hitsMobs) {
      for (const m of game.mobs)
        if (!m.dead && m.def.hostile && Math.abs(nx - m.x) < 0.6 + m.w && Math.abs(nz - m.z) < 0.6 + m.w &&
            ny > m.y - 0.3 && ny < m.y + m.h) { hitMob = m; break; }
    }
    if ((id && Blocks[id].solid) || hitPlayer || hitMob) {
      this.dead = true;
      if (this.kind === 'fire') { game.explode(this.x, this.y, this.z, 2.2, 12); return; }
      game.particles.burst(this.x, this.y, this.z, TileIdx[sp.tile] ?? TileIdx.white, 8, 2);
      Sfx.thud();
      if (hitMob) hitMob.hurt(game, sp.dmg, this.vx * 0.05, this.vz * 0.05);
      // splash shots catch you even on a near miss
      const near = sp.radius && !p.dead &&
        dist2(this.x, this.y, this.z, p.x, p.y + 1, p.z) < sp.radius * sp.radius;
      if (hitPlayer || near) {
        const k = (sp.knock || 1) * 0.1;
        p.hurt(game, sp.dmg, this.vx * k, this.vz * k);
        if (sp.knock) { p.vy = Math.max(p.vy, 9); p.vx += this.vx * 0.5; p.vz += this.vz * 0.5; }
      }
      return;
    }
    this.x = nx; this.y = ny; this.z = nz;
    if (Math.random() < sp.trail)
      game.particles.burst(this.x, this.y, this.z, TileIdx[sp.tile] ?? TileIdx.white, 1, 0.3);
  }
  emit(verts, game) {
    addSprite(verts, this.x, this.y, this.z, this.spec.size, game.player.yaw,
      TileIdx[this.spec.tile] ?? TileIdx.fireball, 1.4);
  }
}

// ---------------------------------------------------------------- mobs
// ---------------------------------------------------------------- the roster
// Every creature is a row of data: hit points, how it moves, which body plan
// draws it, and a handful of behaviour flags the update loop reads. Adding one
// costs a line here, a skin in the atlas and nothing else.
//
// flags: hostile/neutral · burns (undead in daylight) · ranged (bow) ·
// fuse (creeper) · flying+hover · aquatic · jumper · splits · charger ·
// scared (curls up) · watched (freezes while you look at it) · summons ·
// teleports · stationary · lavaProof · light (glows) · follows
const MOB_DEFS = {
  // ---- overworld hostiles ----
  zombie: { hp: 20, speed: 2.1, hostile: true, dmg: 3, burns: true,
    drops: () => [[I.rotten_flesh, randInt(0, 2)]] },
  husk: { hp: 20, speed: 2.0, hostile: true, dmg: 3, plan: 'humanoid', h: 1.95,
    drops: () => [[I.rotten_flesh, randInt(0, 2)]] },
  drowned: { hp: 20, speed: 2.0, hostile: true, dmg: 3, plan: 'humanoid', amphibious: true,
    drops: () => [[I.rotten_flesh, randInt(0, 2)], [I.cod, randInt(0, 1)]] },
  zombie_villager: { hp: 20, speed: 2.0, hostile: true, dmg: 3, burns: true, plan: 'humanoid',
    drops: () => [[I.rotten_flesh, randInt(0, 2)]] },
  skeleton: { hp: 20, speed: 2.2, hostile: true, dmg: 0, ranged: true, burns: true,
    drops: () => [[I.bone, randInt(0, 2)], [I.arrow, randInt(0, 2)]] },
  stray: { hp: 20, speed: 2.2, hostile: true, dmg: 0, ranged: true, plan: 'humanoid',
    drops: () => [[I.bone, randInt(0, 2)], [I.arrow, randInt(1, 2)]] },
  bogged: { hp: 16, speed: 2.0, hostile: true, dmg: 0, ranged: true, plan: 'humanoid',
    drops: () => [[I.bone, randInt(0, 2)], [I.arrow, randInt(0, 2)], [B.brown_mushroom, randInt(0, 1)]] },
  creeper: { hp: 20, speed: 2.4, hostile: true, dmg: 0, fuse: true,
    drops: () => [[I.gunpowder, randInt(0, 2)]] },
  spider: { hp: 16, speed: 2.6, hostile: true, dmg: 2, night: true,
    drops: () => [[I.string, randInt(0, 2)], [I.spider_eye, randInt(0, 1)]] },
  cave_spider: { hp: 12, speed: 3.1, hostile: true, dmg: 2, plan: 'arthro', w: 0.35, h: 0.5,
    drops: () => [[I.string, randInt(0, 2)], [I.spider_eye, randInt(0, 1)]] },
  silverfish: { hp: 8, speed: 2.6, hostile: true, dmg: 1, plan: 'arthro', w: 0.2, h: 0.3,
    drops: () => [] },
  witch: { hp: 26, speed: 1.9, hostile: true, dmg: 0, potion: true, plan: 'humanoid',
    drops: () => [[I.glowstone_dust, randInt(0, 2)], [I.gunpowder, randInt(0, 1)]] },
  slime: { hp: 16, speed: 1.6, hostile: true, dmg: 2, jumper: true, splits: true, plan: 'blob',
    w: 0.5, h: 1.0, drops: () => [[I.slimeball, randInt(1, 2)]] },
  phantom: { hp: 20, speed: 3.0, hostile: true, dmg: 3, flying: true, hover: 14, dive: true,
    plan: 'flyer', burns: true, w: 0.5, h: 0.4,
    drops: () => [[I.phantom_membrane, randInt(0, 1)]] },
  pillager: { hp: 24, speed: 2.1, hostile: true, dmg: 0, ranged: true, plan: 'humanoid',
    drops: () => [[I.arrow, randInt(0, 2)], [I.emerald, randInt(0, 1)]] },
  vindicator: { hp: 24, speed: 2.5, hostile: true, dmg: 6, plan: 'humanoid',
    drops: () => [[I.emerald, randInt(0, 1)]] },
  evoker: { hp: 24, speed: 1.8, hostile: true, dmg: 2, summons: 'vex', plan: 'humanoid',
    drops: () => [[I.emerald, randInt(1, 2)]] },
  vex: { hp: 14, speed: 3.4, hostile: true, dmg: 4, flying: true, hover: 3, dive: true,
    plan: 'flyer', w: 0.2, h: 0.6, light: true, drops: () => [] },
  ravager: { hp: 100, speed: 2.4, hostile: true, dmg: 8, charger: true, plan: 'quad',
    w: 0.9, h: 2.0, drops: () => [[I.emerald, randInt(0, 2)]] },
  breeze: { hp: 30, speed: 2.6, hostile: true, dmg: 0, wind: true, jumper: true, plan: 'humanoid',
    light: true, drops: () => [[I.breeze_rod, randInt(1, 2)]] },
  creaking: { hp: 24, speed: 3.2, hostile: true, dmg: 5, watched: true, plan: 'humanoid',
    h: 2.6, drops: () => [] },
  guardian: { hp: 30, speed: 1.9, hostile: true, dmg: 0, aquatic: true, laser: true, plan: 'fishy',
    w: 0.45, h: 0.85, drops: () => [[I.prismarine_shard, randInt(0, 2)], [I.cod, randInt(0, 1)]] },
  warden: { hp: 250, speed: 1.7, hostile: true, dmg: 14, sonic: true, plan: 'humanoid',
    w: 0.55, h: 2.9, light: true, drops: () => [[I.echo_shard, 1]] },
  enderman: { hp: 40, speed: 2.7, hostile: true, dmg: 5, teleports: true,
    drops: () => [[I.ender_pearl, randInt(0, 1)]] },
  endermite: { hp: 8, speed: 2.4, hostile: true, dmg: 2, plan: 'arthro', w: 0.2, h: 0.3,
    drops: () => [] },

  // ---- overworld passive & neutral ----
  cow: { hp: 10, speed: 1.2, hostile: false,
    drops: () => [[I.beef, randInt(1, 3)], [I.leather, randInt(0, 2)]] },
  mooshroom: { hp: 10, speed: 1.2, hostile: false, plan: 'quad',
    drops: () => [[I.beef, randInt(1, 3)], [B.red_mushroom, randInt(1, 2)]] },
  pig: { hp: 10, speed: 1.2, hostile: false,
    drops: () => [[I.porkchop, randInt(1, 3)]] },
  sheep: { hp: 8, speed: 1.15, hostile: false,
    drops: () => [[B.wool, randInt(1, 2)], [I.mutton, randInt(1, 2)]] },
  chicken: { hp: 4, speed: 1.1, hostile: false,
    drops: () => [[I.chicken, 1], [I.feather, randInt(0, 2)]] },
  rabbit: { hp: 3, speed: 1.9, hostile: false, jumper: true, plan: 'quad', w: 0.2, h: 0.5,
    drops: () => [[I.rabbit, randInt(0, 1)], [I.rabbit_hide, randInt(0, 1)]] },
  fox: { hp: 10, speed: 2.4, hostile: false, plan: 'quad', w: 0.3, h: 0.65,
    drops: () => [] },
  wolf: { hp: 8, speed: 2.6, hostile: false, neutral: true, dmg: 4, plan: 'quad', w: 0.3, h: 0.75,
    drops: () => [] },
  goat: { hp: 10, speed: 2.0, hostile: false, neutral: true, dmg: 3, charger: true, plan: 'quad',
    w: 0.35, h: 1.2, drops: () => [] },
  polar_bear: { hp: 30, speed: 1.9, hostile: false, neutral: true, dmg: 6, plan: 'quad',
    w: 0.65, h: 1.35, drops: () => [[I.cod, randInt(0, 2)]] },
  panda: { hp: 20, speed: 1.2, hostile: false, plan: 'quad', w: 0.6, h: 1.2,
    drops: () => [] },
  llama: { hp: 15, speed: 1.5, hostile: false, neutral: true, dmg: 2, plan: 'quad',
    w: 0.4, h: 1.6, drops: () => [[I.leather, randInt(0, 2)]] },
  horse: { hp: 22, speed: 3.0, hostile: false, plan: 'quad', w: 0.6, h: 1.55,
    drops: () => [[I.leather, randInt(0, 2)]] },
  camel: { hp: 32, speed: 2.2, hostile: false, plan: 'quad', w: 0.6, h: 2.2,
    drops: () => [[I.leather, randInt(0, 1)]] },
  sniffer: { hp: 14, speed: 1.0, hostile: false, plan: 'quad', w: 0.7, h: 1.7,
    drops: () => [[I.wheat_seeds, randInt(1, 3)]] },
  armadillo: { hp: 12, speed: 1.4, hostile: false, scared: true, plan: 'quad', w: 0.35, h: 0.6,
    drops: () => [[I.scute, randInt(0, 1)]] },
  turtle: { hp: 30, speed: 0.7, hostile: false, amphibious: true, plan: 'quad', w: 0.55, h: 0.5,
    drops: () => [[I.scute, randInt(0, 1)]] },
  frog: { hp: 10, speed: 1.3, hostile: false, jumper: true, plan: 'quad', w: 0.25, h: 0.5,
    drops: () => [] },
  parrot: { hp: 6, speed: 2.2, hostile: false, flying: true, hover: 5, plan: 'flyer', w: 0.2, h: 0.6,
    drops: () => [[I.feather, randInt(1, 2)]] },
  bat: { hp: 6, speed: 2.4, hostile: false, flying: true, hover: 4, plan: 'flyer', w: 0.2, h: 0.4,
    drops: () => [] },
  bee: { hp: 10, speed: 2.0, hostile: false, neutral: true, dmg: 2, flying: true, hover: 6,
    plan: 'flyer', w: 0.25, h: 0.4, drops: () => [[I.honeycomb, randInt(0, 1)]] },
  allay: { hp: 20, speed: 2.6, hostile: false, flying: true, hover: 3, follows: true,
    plan: 'flyer', light: true, w: 0.2, h: 0.6, drops: () => [] },
  happy_ghast: { hp: 20, speed: 1.2, hostile: false, flying: true, hover: 12, plan: 'ghastly',
    w: 1.9, h: 3.8, drops: () => [] },
  squid: { hp: 10, speed: 1.4, hostile: false, aquatic: true, plan: 'squid', w: 0.45, h: 0.8,
    drops: () => [[I.ink_sac, randInt(1, 3)]] },
  glow_squid: { hp: 10, speed: 1.4, hostile: false, aquatic: true, plan: 'squid', light: true,
    w: 0.45, h: 0.8, drops: () => [[I.glow_ink_sac, randInt(1, 3)]] },
  dolphin: { hp: 10, speed: 3.2, hostile: false, aquatic: true, plan: 'fishy', w: 0.45, h: 0.6,
    drops: () => [[I.cod, randInt(0, 1)]] },
  cod: { hp: 3, speed: 1.6, hostile: false, aquatic: true, plan: 'fishy', w: 0.2, h: 0.3,
    drops: () => [[I.cod, 1]] },
  salmon: { hp: 3, speed: 1.8, hostile: false, aquatic: true, plan: 'fishy', w: 0.22, h: 0.34,
    drops: () => [[I.salmon, 1]] },
  axolotl: { hp: 14, speed: 1.8, hostile: false, aquatic: true, plan: 'fishy', w: 0.25, h: 0.35,
    drops: () => [] },
  villager: { hp: 20, speed: 1.5, hostile: false, plan: 'humanoid',
    drops: () => [[I.emerald, randInt(0, 1)]] },
  iron_golem: { hp: 100, speed: 1.6, hostile: false, neutral: true, dmg: 12, plan: 'humanoid',
    guard: true, w: 0.6, h: 2.7, drops: () => [[I.iron_ingot, randInt(2, 4)], [B.poppy, 1]] },
  snow_golem: { hp: 4, speed: 1.4, hostile: false, snowballs: true, plan: 'humanoid', guard: true,
    w: 0.35, h: 1.9, drops: () => [[I.snowball, randInt(1, 3)]] },
  copper_golem: { hp: 20, speed: 1.8, hostile: false, plan: 'humanoid', light: true, w: 0.3, h: 1.2,
    drops: () => [[I.copper_ingot, randInt(1, 2)]] },

  // ---- the Nether ----
  ghast: { hp: 10, speed: 1.5, hostile: true, dmg: 0, flying: true, shoots: 1, hover: 22,
    drops: () => [[I.gunpowder, randInt(0, 2)]] },
  blaze: { hp: 20, speed: 1.8, hostile: true, dmg: 0, flying: true, shoots: 0, hover: 3,
    drops: () => [[I.blaze_rod, randInt(0, 2)]], light: true },
  pigman: { hp: 20, speed: 2.0, hostile: false, neutral: true, dmg: 4,
    drops: () => [[I.gold_ingot, randInt(0, 1)], [I.rotten_flesh, randInt(0, 1)]] },
  piglin_brute: { hp: 50, speed: 2.3, hostile: true, dmg: 7, plan: 'humanoid', lavaProof: false,
    drops: () => [[I.gold_ingot, randInt(1, 2)]] },
  wither_skeleton: { hp: 20, speed: 2.3, hostile: true, dmg: 7, plan: 'humanoid', h: 2.4,
    drops: () => [[I.bone, randInt(0, 2)], [I.coal, randInt(0, 1)],
                  ...(Math.random() < 0.08 ? [[I.wither_skeleton_skull, 1]] : [])] },
  hoglin: { hp: 40, speed: 2.2, hostile: true, dmg: 6, charger: true, plan: 'quad', w: 0.7, h: 1.4,
    drops: () => [[I.porkchop, randInt(2, 4)], [I.leather, randInt(0, 1)]] },
  magma_cube: { hp: 16, speed: 1.6, hostile: true, dmg: 4, jumper: true, splits: true, plan: 'blob',
    lavaProof: true, light: true, w: 0.5, h: 1.0, drops: () => [[I.magma_cream, randInt(0, 1)]] },
  strider: { hp: 20, speed: 1.4, hostile: false, plan: 'quad', lavaProof: true, light: true,
    w: 0.45, h: 1.6, drops: () => [[I.string, randInt(1, 3)]] },

  // ---- The End ----
  shulker: { hp: 30, speed: 0, hostile: true, dmg: 0, stationary: true, bullet: true, plan: 'cube',
    w: 0.5, h: 1.0, drops: () => [[I.shulker_shell, randInt(0, 1)]] },
};

// ---------------------------------------------------------------- spawn tables
// [kind, weight, filter, where]. `where` is the sort of spot the spawner has to
// find: solid ground under open sky, a cave pocket, open air, or deep water.
const SPAWN_TABLES = {
  overworld: {
    hostile: [
      ['zombie', 10], ['skeleton', 9], ['creeper', 8], ['spider', 6],
      ['husk', 6, { biome: 'desert' }], ['stray', 6, { biome: 'snow' }],
      ['bogged', 4, { biome: 'forest' }], ['zombie_villager', 2],
      ['witch', 2], ['enderman', 3], ['pillager', 3], ['vindicator', 2],
      ['evoker', 1], ['breeze', 2], ['creaking', 3, { biome: 'forest' }], ['ravager', 1],
      ['zombie', 6, null, 'cave'], ['skeleton', 6, null, 'cave'], ['creeper', 4, null, 'cave'],
      ['cave_spider', 6, null, 'cave'], ['silverfish', 5, null, 'cave'], ['slime', 5, { maxY: 40 }, 'cave'],
      ['endermite', 3, { maxY: 34 }, 'cave'], ['witch', 1, null, 'cave'],
      ['warden', 1, { maxY: 16 }, 'cave'],
      ['phantom', 6, null, 'air'], ['vex', 2, null, 'air'],
      ['drowned', 8, null, 'water'], ['guardian', 3, null, 'water'],
    ],
    passive: [
      ['cow', 8], ['pig', 8], ['sheep', 8], ['chicken', 7], ['rabbit', 5],
      ['fox', 3], ['wolf', 3], ['horse', 4], ['villager', 4], ['frog', 3], ['turtle', 3],
      ['goat', 4, { biome: 'mountains' }], ['llama', 3, { biome: 'mountains' }],
      ['polar_bear', 4, { biome: 'snow' }], ['snow_golem', 2, { biome: 'snow' }],
      ['panda', 3, { biome: 'forest' }], ['camel', 4, { biome: 'desert' }],
      ['armadillo', 4, { biome: 'desert' }], ['sniffer', 1], ['mooshroom', 1],
      ['iron_golem', 1], ['copper_golem', 2],
      ['bat', 8, null, 'cave'], ['copper_golem', 1, null, 'cave'],
      ['bee', 5, null, 'air'], ['parrot', 4, { biome: 'forest' }, 'air'],
      ['bat', 4, null, 'air'], ['allay', 2, null, 'air'], ['happy_ghast', 1, null, 'air'],
      ['squid', 6, null, 'water'], ['glow_squid', 3, null, 'water'], ['dolphin', 3, null, 'water'],
      ['cod', 6, null, 'water'], ['salmon', 5, null, 'water'], ['axolotl', 3, null, 'water'],
    ],
  },
  nether: {
    hostile: [
      ['magma_cube', 6], ['hoglin', 5], ['wither_skeleton', 4], ['piglin_brute', 3],
      ['magma_cube', 4, null, 'cave'], ['wither_skeleton', 3, null, 'cave'],
      ['ghast', 8, null, 'air'],
    ],
    passive: [
      ['pigman', 8], ['strider', 5],
      ['pigman', 4, null, 'cave'],
    ],
  },
  end: {
    hostile: [
      ['enderman', 10], ['shulker', 4], ['endermite', 3],
      ['enderman', 6, null, 'cave'],
    ],
    passive: [],
  },
};

class Mob extends Entity {
  constructor(kind, x, y, z) {
    super(x, y, z);
    this.kind = kind;
    const d = MOB_DEFS[kind];
    this.hp = d.hp; this.maxHp = d.hp;
    this.def = d;
    const SIZES = { chicken: [0.22, 0.7], spider: [0.6, 0.8], enderman: [0.3, 2.9],
                    ghast: [1.9, 3.8], blaze: [0.3, 1.8] };
    const sz = SIZES[kind] || [0.32, 1.8];
    this.w = d.w ?? sz[0]; this.h = d.h ?? sz[1];
    this.scale = 1;                    // slimes shrink as they split
    this.yaw = rand(0, Math.PI * 2);
    this.wanderT = 0;
    this.moveX = 0; this.moveZ = 0;
    this.attackCd = 0;
    this.shootCd = 0;
    this.fuseT = -1;
    this.hurtT = 0;
    this.burnT = 0;
    this.anim = 0;
  }
  hurt(game, dmg, kx = 0, kz = 0) {
    if (this.def.neutral) this.angry = true;   // wolves, bees, golems and pigmen turn on you
    if (this.def.scared) this.curl = 4;        // an armadillo balls up the moment it is hit
    if (this.def.teleports && Math.random() < 0.5 && this.hp > dmg) this.blink(game);
    this.hp -= dmg;
    this.hurtT = 0.5;
    this.vx += kx * 6; this.vz += kz * 6; this.vy = Math.max(this.vy, 5);
    Sfx.mobHurt(this.kind);
    if (this.hp <= 0) this.die(game);
  }
  die(game) {
    if (this.dead) return;
    this.dead = true;
    const drops = this.def.drops();
    for (const [id, n] of drops) if (n > 0) game.spawnDrop(this.x, this.y + 0.5, this.z, id, n);
    game.particles.burst(this.x, this.y + this.h / 2, this.z, TileIdx.white, 10);
    game.spawnXp(this.x, this.y + 0.5, this.z, this.def.hostile ? 5 : 2);
    // a big slime bursts into two small ones, which burst again
    if (this.def.splits && this.scale > 0.45 && game.mobs.length < 40) {
      for (let i = 0; i < 2; i++) {
        const m = new Mob(this.kind, this.x + rand(-0.6, 0.6), this.y + 0.2, this.z + rand(-0.6, 0.6));
        m.setScale(this.scale * 0.55);
        game.mobs.push(m);
      }
    }
    if (this.def.hostile) { game.stats.kills++; game.ach('hunter', 'Monster Hunter'); }
  }
  setScale(s) {
    this.scale = s;
    this.w *= s; this.h *= s;
    this.maxHp = Math.max(1, Math.round(this.maxHp * s)); this.hp = this.maxHp;
  }
  update(game, dt) {
    this.age += dt; this.hurtT -= dt; this.attackCd -= dt; this.shootCd -= dt;
    const world = game.world, p = game.player;
    const d2p = dist2(this.x, this.y, this.z, p.x, p.y, p.z);

    // daylight burning for undead
    if (this.def.burns && game.day > 0.5 && world.skyAt(this.x, this.y + this.h, this.z) > 0.95) {
      this.burnT += dt;
      if (this.burnT > 1) { this.burnT = 0; this.hurt(game, 2); game.particles.burst(this.x, this.y + this.h, this.z, TileIdx.lava, 3); }
    }

    // lava and fire are home for some of them
    if (this.def.lavaProof) this.burnT = 0;

    // a creaking only moves when nobody is watching, and cannot be hurt while seen
    if (this.def.watched) {
      this.seen = this.inPlayerView(p) && this.canSee(game, p);
      if (this.seen) {
        this.vx = this.vz = 0; this.moveX = this.moveZ = 0;
        this.physics(world, dt);
        return;
      }
    }
    // an armadillo rolls into a ball rather than running
    if (this.def.scared) {
      if (d2p < 5 * 5 && !p.dead) this.curl = Math.max(this.curl || 0, 1.2);
      this.curl = Math.max(0, (this.curl || 0) - dt);
      if (this.curl > 0) {
        this.vx *= 0.6; this.vz *= 0.6; this.moveX = this.moveZ = 0;
        this.physics(world, dt);
        return;
      }
    }
    // shulkers are bolted to their block and just shoot
    if (this.def.stationary) { this.turretUpdate(game, dt, p, d2p); return; }
    // fish, squid, dolphins and guardians live in the water column
    if (this.def.aquatic) { this.swimUpdate(game, dt, p, d2p); return; }
    // ghasts, phantoms, bats, bees and the rest of the fliers hold station in the air
    if (this.def.flying) { this.flyUpdate(game, dt, p, d2p); return; }

    let targeting = false;
    if ((this.def.hostile || this.angry) && !p.dead && d2p < (this.angry ? 32 * 32 : 20 * 20)) {
      targeting = true;
      const dx = p.x - this.x, dz = p.z - this.z;
      const dl = Math.hypot(dx, dz) || 1;
      this.yaw = Math.atan2(dx, dz);
      if (this.def.ranged) {
        // skeleton: keep distance, shoot
        if (d2p > 100) { this.moveX = dx / dl; this.moveZ = dz / dl; }
        else if (d2p < 36) { this.moveX = -dx / dl; this.moveZ = -dz / dl; }
        else { this.moveX = 0; this.moveZ = 0; }
        if (this.shootCd <= 0 && d2p < 180 && this.canSee(game, p)) {
          this.shootCd = 2.2;
          const dy = (p.y + 1.4) - (this.y + 1.4);
          const sp = 16, dd = Math.sqrt(d2p);
          game.arrows.push(new Arrow(this.x, this.y + 1.4, this.z,
            dx / dd * sp, dy / dd * sp + dd * 0.32, dz / dd * sp));
          Sfx.bow();
        }
      } else if (this.def.fuse) {
        if (d2p < 6) {
          if (this.fuseT < 0) { this.fuseT = 1.5; Sfx.fuse(); }
          this.moveX = 0; this.moveZ = 0;
        } else if (this.fuseT < 0) { this.moveX = dx / dl; this.moveZ = dz / dl; }
        if (this.fuseT >= 0) {
          this.fuseT -= dt;
          if (this.fuseT <= 0) { this.explode(game); return; }
        }
      } else if (this.def.wind) {
        // a breeze bounces around and fires wind charges that shove you off ledges
        if (d2p < 36) { this.moveX = -dx / dl; this.moveZ = -dz / dl; }
        else if (d2p > 120) { this.moveX = dx / dl; this.moveZ = dz / dl; }
        else { this.moveX = 0; this.moveZ = 0; }
        if (this.onGround && Math.random() < dt * 1.6) this.vy = 11;
        if (this.shootCd <= 0 && d2p < 260 && this.canSee(game, p)) {
          this.shootCd = 2.6;
          this.launch(game, p, 15, 'wind');
        }
      } else if (this.def.potion) {
        // a witch lobs splash potions in an arc and backs away up close
        if (d2p < 25) { this.moveX = -dx / dl; this.moveZ = -dz / dl; }
        else if (d2p > 100) { this.moveX = dx / dl; this.moveZ = dz / dl; }
        else { this.moveX = 0; this.moveZ = 0; }
        if (this.shootCd <= 0 && d2p < 200 && this.canSee(game, p)) {
          this.shootCd = 3;
          this.launch(game, p, 12, 'potion', Math.sqrt(d2p) * 0.3);
        }
      } else if (this.def.sonic) {
        // the warden closes slowly, and answers distance with a sonic shriek
        this.moveX = dx / dl; this.moveZ = dz / dl;
        if (this.shootCd <= 0 && d2p > 16 && d2p < 400 && this.canSee(game, p)) {
          this.shootCd = 4.5;
          Sfx.dragon();
          for (let i = 0; i < 14; i++)
            game.particles.burst(this.x + dx * (i / 14), this.y + 1.6 + (p.y - this.y) * (i / 14),
              this.z + dz * (i / 14), TileIdx.white, 1, 0.4);
          p.hurt(game, 10, dx / dl * 0.6, dz / dl * 0.6);
        }
        if (d2p < 4 && this.attackCd <= 0) {
          this.attackCd = 1.4;
          p.hurt(game, this.def.dmg, dx / dl * 1.2, dz / dl * 1.2);
        }
      } else if (this.def.summons) {
        // an evoker hangs back and calls in vexes
        if (d2p < 64) { this.moveX = -dx / dl; this.moveZ = -dz / dl; }
        else { this.moveX = dx / dl; this.moveZ = dz / dl; }
        if (this.shootCd <= 0 && d2p < 300 && game.mobs.length < 34 && this.canSee(game, p)) {
          this.shootCd = 8;
          Sfx.pop();
          for (let i = 0; i < 2; i++)
            game.mobs.push(new Mob(this.def.summons, this.x + rand(-2, 2), this.y + 1, this.z + rand(-2, 2)));
        }
      } else if (this.def.charger) {
        // ravagers, hoglins and goats wind up, then run you down
        this.chargeT = (this.chargeT ?? 0) - dt;
        if (this.chargeT > 0) {
          this.moveX = this.chargeX; this.moveZ = this.chargeZ;
        } else if (d2p > 9 && d2p < 400 && this.chargeT < -2.5) {
          this.chargeT = 1.4; this.chargeX = dx / dl; this.chargeZ = dz / dl;
        } else {
          this.moveX = dx / dl; this.moveZ = dz / dl;
        }
        if (d2p < 3.2 && this.attackCd <= 0) {
          this.attackCd = 1.2;
          const power = this.chargeT > 0 ? 1.6 : 0.6;
          p.hurt(game, this.def.dmg, dx / dl * power, dz / dl * power);
          this.chargeT = -1;
        }
      } else {
        this.moveX = dx / dl; this.moveZ = dz / dl;
        if (d2p < 2.2 + this.w * 2 && this.attackCd <= 0) {
          this.attackCd = 1;
          p.hurt(game, this.def.dmg, dx / dl * 0.5, dz / dl * 0.5);
        }
      }
    }
    // snow golems and iron golems pick fights with whatever is hunting you
    if (this.def.guard && this.shootCd <= 0) {
      let best = null, bd = this.def.snowballs ? 18 * 18 : 6 * 6;
      for (const m of game.mobs) {
        if (m === this || m.dead || !m.def.hostile) continue;
        const d = dist2(m.x, m.y, m.z, this.x, this.y, this.z);
        if (d < bd) { bd = d; best = m; }
      }
      if (best) {
        this.yaw = Math.atan2(best.x - this.x, best.z - this.z);
        this.shootCd = this.def.snowballs ? 1.2 : 1;
        if (this.def.snowballs) this.launch(game, best, 18, 'snow');
        else best.hurt(game, this.def.dmg, (best.x - this.x) * 0.2, (best.z - this.z) * 0.2);
      }
    }
    // chickens lay eggs now and then
    if (this.kind === 'chicken') {
      this.eggT = (this.eggT ?? rand(90, 240)) - dt;
      if (this.eggT <= 0) { this.eggT = rand(120, 300); game.spawnDrop(this.x, this.y + 0.2, this.z, I.egg, 1); Sfx.pop(); }
    }
    if (!targeting) {
      this.fuseT = -1;
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = rand(1.5, 5);
        if (Math.random() < 0.55) { this.moveX = 0; this.moveZ = 0; }
        else {
          this.yaw = rand(0, Math.PI * 2);
          this.moveX = Math.sin(this.yaw); this.moveZ = Math.cos(this.yaw);
        }
      }
    }
    let sp = this.def.speed * (targeting && !this.def.ranged ? 1.15 : 0.6) * (targeting ? 1.4 : 1);
    if (this.chargeT > 0) sp *= 2.2;                    // mid-charge
    if (this.def.jumper) {
      // slimes, frogs and rabbits hop: they only get a shove while airborne
      this.hopT = (this.hopT ?? rand(0, 1)) - dt;
      if (this.onGround) {
        this.vx *= 0.7; this.vz *= 0.7;
        if (this.hopT <= 0 && (this.moveX || this.moveZ || targeting)) {
          this.hopT = targeting ? 0.55 : rand(0.9, 2.2);
          this.vy = 7.5;
          this.vx = this.moveX * sp * 1.6; this.vz = this.moveZ * sp * 1.6;
        }
      }
    } else {
      this.vx = lerp(this.vx, this.moveX * sp, 0.12);
      this.vz = lerp(this.vz, this.moveZ * sp, 0.12);
    }
    // jump over obstacles
    if ((this.moveX || this.moveZ) && this.onGround && !this.def.jumper) {
      const ahead = world.getBlock(this.x + this.moveX * 0.8, this.y + 0.4, this.z + this.moveZ * 0.8);
      if (ahead && Blocks[ahead].solid) this.vy = 8.2;
      else if (this.inWater) this.vy = 3;
    }
    if (this.inWater && (this.moveX || this.moveZ)) this.vy = Math.max(this.vy, 1.5);
    this.physics(world, dt);
    this.anim += Math.hypot(this.vx, this.vz) * dt * 3.2;
    if (this.y < -10) this.dead = true;
    // cactus / lava damage — striders and magma cubes are at home in it
    const at = world.getBlock(this.x, this.y, this.z);
    if (at === B.lava && !this.def.lavaProof) this.hurt(game, 4);
    if (this.def.lavaProof && at === B.lava) {           // float rather than sink
      this.vy = Math.max(this.vy, 2.5);
      this.onGround = true;
    }
    if (at === B.cactus) this.hurt(game, 1);
  }
  // lob something at a target with a bit of arc
  launch(game, target, speed, kind, arc = 0) {
    const ex = this.x, ey = this.y + this.h * 0.8, ez = this.z;
    const tx = target.x - ex, ty = (target.y + 1) - ey, tz = target.z - ez;
    const d = Math.hypot(tx, ty, tz) || 1;
    game.fireballs.push(new Fireball(ex, ey, ez,
      tx / d * speed, ty / d * speed + arc, tz / d * speed, 0, kind));
    Sfx.fireball();
  }
  // is this mob inside the player's view cone? (the creaking's whole trick)
  inPlayerView(p) {
    const dx = this.x - p.x, dz = this.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const look = p.lookDir();
    return (dx / d * look[0] + dz / d * look[2]) > 0.4;
  }
  explode(game) {
    this.dead = true;
    game.explode(this.x, this.y + 0.5, this.z, 2.6, 24);
  }
  flyUpdate(game, dt, p, d2p) {
    const world = game.world;
    const aggro = !p.dead && d2p < 46 * 46;
    // hold station above the ground, drifting toward or away from the player
    let ty = this.y;
    let gy = this.y;
    for (let y = Math.floor(this.y); y > 2; y--) {
      const id = world.getBlock(this.x, y, this.z);
      if (id && Blocks[id].solid) { gy = y + 1; break; }
    }
    // friendly fliers tag along at the player's shoulder instead of a fixed height
    ty = this.def.follows && !p.dead && d2p < 40 * 40 ? p.y + 2 : gy + this.def.hover;
    this.vy = lerp(this.vy, clamp((ty - this.y) * 1.5, -4, 4), 0.08);
    const shoots = this.def.shoots !== undefined;
    const chases = this.def.hostile || this.angry || this.def.follows;
    if (aggro && chases) {
      const dx = p.x - this.x, dz = p.z - this.z;
      const dl = Math.hypot(dx, dz) || 1;
      this.yaw = Math.atan2(dx, dz);
      if (this.def.dive) {
        // phantoms and vexes swoop straight at you instead of holding station
        const dy = (p.y + 1.2) - this.y;
        const d3 = Math.hypot(dx, dy, dz) || 1;
        const sp3 = this.def.speed * 2.2;
        this.vx = lerp(this.vx, dx / d3 * sp3, 0.08);
        this.vy = lerp(this.vy, dy / d3 * sp3, 0.08);
        this.vz = lerp(this.vz, dz / d3 * sp3, 0.08);
        if (d3 < 1.6 + this.w && this.attackCd <= 0) {
          this.attackCd = 1.4;
          p.hurt(game, this.def.dmg, dx / dl * 0.6, dz / dl * 0.6);
          this.vy = 6;                            // peel off after the pass
        }
        this.driftStep(world, dt);
        this.anim += dt;
        if (this.y < -10) this.dead = true;
        return;
      }
      const want = this.def.follows ? 3 : (this.def.shoots ? 16 : 6);   // ghasts keep their distance
      const push = (dl - want) / Math.max(dl, 1);
      this.vx = lerp(this.vx, dx * push * this.def.speed * 0.5, 0.04);
      this.vz = lerp(this.vz, dz * push * this.def.speed * 0.5, 0.04);
      if (this.def.dmg && !shoots && d2p < 4 && this.attackCd <= 0) {
        this.attackCd = 1.4;                      // a bee that has had enough of you
        p.hurt(game, this.def.dmg, dx / dl * 0.4, dz / dl * 0.4);
      }
      if (shoots && this.shootCd <= 0 && d2p < 40 * 40 && this.canSee(game, p)) {
        this.shootCd = this.def.shoots ? 3.2 : 1.8;
        const ex = this.x, ey = this.y + this.h * 0.5, ez = this.z;
        const tx = p.x - ex, ty2 = (p.y + 1.2) - ey, tz = p.z - ez;
        const d = Math.hypot(tx, ty2, tz) || 1;
        const sp2 = this.def.shoots ? 12 : 18;
        const n = this.def.shoots ? 1 : 3;        // blazes fire a short burst
        for (let i = 0; i < n; i++) {
          const j = i * 0.06;
          game.fireballs.push(new Fireball(ex, ey, ez,
            (tx / d + rand(-j, j)) * sp2, (ty2 / d + rand(-j, j)) * sp2, (tz / d + rand(-j, j)) * sp2,
            this.def.shoots));
        }
        Sfx.fireball();
      }
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = rand(2, 6);
        this.yaw = rand(0, Math.PI * 2);
        this.vx = Math.sin(this.yaw) * this.def.speed * 0.5;
        this.vz = Math.cos(this.yaw) * this.def.speed * 0.5;
      }
    }
    this.driftStep(world, dt);
    this.anim += dt;
    if (this.kind === 'blaze' && Math.random() < 0.25)
      game.particles.burst(this.x, this.y + 0.4, this.z, TileIdx.fireball, 1, 0.6);
    if (this.y < -10) this.dead = true;
  }
  // free movement through the air (or water), bouncing off anything solid
  driftStep(world, dt) {
    const step = (ax, v) => {
      const nx = this.x + (ax === 0 ? v : 0), ny = this.y + (ax === 1 ? v : 0), nz = this.z + (ax === 2 ? v : 0);
      if (world.boxCollides(nx - this.w, ny, nz - this.w, nx + this.w, ny + this.h, nz + this.w)) {
        if (ax === 0) this.vx = -this.vx * 0.4;
        else if (ax === 1) this.vy = -this.vy * 0.4;
        else this.vz = -this.vz * 0.4;
        return;
      }
      this.x = nx; this.y = ny; this.z = nz;
    };
    step(0, this.vx * dt); step(1, this.vy * dt); step(2, this.vz * dt);
  }

  // ---- water dwellers: fish, squid, dolphins, guardians ----
  swimUpdate(game, dt, p, d2p) {
    const world = game.world;
    const inWater = world.getBlock(this.x, this.y + this.h * 0.5, this.z) === B.water;
    this.inWater = inWater;
    if (!inWater) {
      // flopping on land: gravity, and it suffocates
      this.vy -= 24 * dt;
      this.vx *= 0.8; this.vz *= 0.8;
      if (Math.random() < dt * 3) this.vy = 4;
      this.driftStep(world, dt);
      this.gasp = (this.gasp || 0) + dt;
      if (this.gasp > 4) { this.gasp = 0; this.hurt(game, 2); }
      return;
    }
    this.gasp = 0;
    const hunting = (this.def.hostile || this.angry) && !p.dead && d2p < 24 * 24 &&
                    p.headInWater(world);
    if (hunting) {
      const dx = p.x - this.x, dy = (p.y + 1) - this.y, dz = p.z - this.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      this.yaw = Math.atan2(dx, dz);
      if (this.def.laser) {
        // a guardian holds position and burns you with its beam
        if (d > 5) { this.vx = dx / d * this.def.speed; this.vz = dz / d * this.def.speed; this.vy = dy / d * this.def.speed; }
        else { this.vx *= 0.85; this.vz *= 0.85; this.vy *= 0.85; }
        this.beam = Math.max(0, (this.beam || 0) - dt);
        if (this.shootCd <= 0 && d < 14 && this.canSee(game, p)) {
          this.shootCd = 3.5; this.beam = 0.6;
          for (let i = 0; i < 10; i++)
            game.particles.burst(this.x + dx * (i / 10), this.y + 0.4 + dy * (i / 10), this.z + dz * (i / 10),
              TileIdx.white, 1, 0.2);
          p.hurt(game, 5, dx / d * 0.2, dz / d * 0.2);
          Sfx.fireball();
        }
      } else {
        const sp = this.def.speed * 1.6;
        this.vx = lerp(this.vx, dx / d * sp, 0.1);
        this.vy = lerp(this.vy, dy / d * sp, 0.1);
        this.vz = lerp(this.vz, dz / d * sp, 0.1);
        if (d < 1.4 + this.w && this.attackCd <= 0) {
          this.attackCd = 1.2;
          p.hurt(game, this.def.dmg, dx / d * 0.4, dz / d * 0.4);
        }
      }
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = rand(1.5, 4.5);
        this.yaw = rand(0, Math.PI * 2);
        this.pitchV = rand(-0.5, 0.5);
        const sp = this.def.speed * 0.8;
        this.vx = Math.sin(this.yaw) * sp; this.vz = Math.cos(this.yaw) * sp;
        this.vy = this.pitchV;
      }
      // stay under the surface and off the bottom
      if (world.getBlock(this.x, this.y + this.h + 0.6, this.z) !== B.water) this.vy = Math.min(this.vy, -0.4);
      if (world.getBlock(this.x, this.y - 0.4, this.z) !== B.water) this.vy = Math.max(this.vy, 0.4);
    }
    this.driftStep(world, dt);
    this.anim += Math.hypot(this.vx, this.vy, this.vz) * dt * 4;
    if (this.y < -10) this.dead = true;
  }

  // ---- shulkers: bolted in place, all turret ----
  turretUpdate(game, dt, p, d2p) {
    this.vx = this.vy = this.vz = 0;
    this.anim += dt;
    this.open = clamp((this.open ?? 0) + (d2p < 18 * 18 ? dt * 2 : -dt * 2), 0, 1);
    if (d2p < 18 * 18 && !p.dead && this.shootCd <= 0 && this.canSee(game, p)) {
      this.shootCd = 2.4;
      this.yaw = Math.atan2(p.x - this.x, p.z - this.z);
      this.launch(game, p, 7, 'bullet');
    }
  }

  blink(game) {
    // endermen vanish and reappear a short way off
    for (let tries = 0; tries < 12; tries++) {
      const nx = this.x + rand(-9, 9), nz = this.z + rand(-9, 9);
      const ny = game.findSpawnY(nx, nz);
      if (ny < 2 || ny > WORLD_H - 3) continue;
      if (game.world.boxCollides(nx - this.w, ny, nz - this.w, nx + this.w, ny + this.h, nz + this.w)) continue;
      game.particles.burst(this.x, this.y + 1, this.z, TileIdx.enderman_face, 10, 2);
      this.x = nx; this.y = ny; this.z = nz;
      game.particles.burst(nx, ny + 1, nz, TileIdx.enderman_face, 10, 2);
      Sfx.pop();
      return;
    }
  }
  canSee(game, p) {
    const ex = this.x, ey = this.y + 1.4, ez = this.z;
    const dx = p.x - ex, dy = (p.y + 1.4) - ey, dz = p.z - ez;
    const d = Math.hypot(dx, dy, dz) || 1;
    const hit = game.world.raycast(ex, ey, ez, dx / d, dy / d, dz / d, d);
    return !hit;
  }
  emit(verts, game) {
    let l0 = Math.max(0.12, game.world.skyAt(this.x, this.y + 1, this.z));
    if (this.def.light) l0 = Math.max(l0, 1.25);          // the ones that glow
    const l = this.hurtT > 0.35 ? 1.6 : l0;   // flash when hurt
    const yaw = this.yaw;
    const swing = Math.sin(this.anim * 4) * 0.5;
    const k = this.kind, x = this.x, z = this.z;
    const Tt = (n) => TileIdx[n];
    // most of the roster draws itself from its body plan
    if (this.def.plan) { PLANS[this.def.plan](this, verts, l, yaw, swing); return; }
    const humanoid = (skinFace, skinSide, shirt, pants, armT) => {
      const y = this.y;
      // legs
      limb(verts, x, y + 0.75, z, yaw, 0.13, 0, 0.12, 0.12, 0.75, pants, l, swing);
      limb(verts, x, y + 0.75, z, yaw, -0.13, 0, 0.12, 0.12, 0.75, pants, l, -swing);
      // body
      addBoxYaw(verts, x, y + 0.75 + 0.375, z, yaw, 0, 0, 0.26, 0.375, 0.15, { all: shirt }, l);
      // arms (zombie holds arms forward)
      const armAng = (k === 'zombie' || k === 'pigman') ? -1.4 : swing;
      limb(verts, x, y + 1.42, z, yaw, 0.36, 0, 0.1, 0.1, 0.68, armT, l, armAng);
      limb(verts, x, y + 1.42, z, yaw, -0.36, 0, 0.1, 0.1, 0.68, armT, l, (k === 'zombie' || k === 'pigman') ? armAng : -swing);
      // head
      addBoxYaw(verts, x, y + 1.5 + 0.25, z, yaw, 0, 0, 0.25, 0.25, 0.25, { all: skinSide, front: skinFace }, l);
    };
    if (k === 'enderman') {
      const y = this.y, T2 = Tt('enderman_skin');
      limb(verts, x, y + 1.3, z, yaw, 0.11, 0, 0.07, 0.07, 1.3, T2, l, swing);
      limb(verts, x, y + 1.3, z, yaw, -0.11, 0, 0.07, 0.07, 1.3, T2, l, -swing);
      addBoxYaw(verts, x, y + 1.3 + 0.55, z, yaw, 0, 0, 0.17, 0.55, 0.11, { all: T2 }, l);
      limb(verts, x, y + 2.4, z, yaw, 0.26, 0, 0.06, 0.06, 1.25, T2, l, -swing * 0.6);
      limb(verts, x, y + 2.4, z, yaw, -0.26, 0, 0.06, 0.06, 1.25, T2, l, swing * 0.6);
      addBoxYaw(verts, x, y + 2.62, z, yaw, 0, 0, 0.22, 0.22, 0.22,
        { all: T2, front: Tt('enderman_face') }, Math.max(l, 0.9));
      return;
    }
    if (k === 'ghast') {
      const y = this.y, T2 = Tt('ghast_skin');
      const face = this.shootCd > 2.4 ? Tt('ghast_face_angry') : Tt('ghast_face');
      addBoxYaw(verts, x, y + 2.1, z, yaw, 0, 0, 1.6, 1.6, 1.6, { all: T2, front: face }, Math.max(l, 0.75));
      // nine drifting tentacles
      for (let i = 0; i < 9; i++) {
        const ox = ((i % 3) - 1) * 0.9, oz = (((i / 3) | 0) - 1) * 0.9;
        const len = 0.7 + ((i * 7) % 5) * 0.22;
        const sway = Math.sin(this.anim * 1.6 + i) * 0.1;
        addBoxYaw(verts, x + sway, y + 0.5 - len / 2 + 0.1, z, yaw, ox, oz, 0.16, len / 2, 0.16,
          { all: T2 }, Math.max(l, 0.6));
      }
      return;
    }
    if (k === 'blaze') {
      const y = this.y;
      addBoxYaw(verts, x, y + 1.1, z, yaw, 0, 0, 0.28, 0.34, 0.28,
        { all: Tt('blaze_skin'), front: Tt('blaze_face') }, 1.5);
      // rods spinning around the core
      for (let i = 0; i < 8; i++) {
        const a = this.anim * 1.8 + (i / 8) * Math.PI * 2;
        const r = 0.42 + (i % 2) * 0.16;
        const ry = 0.5 + (i % 3) * 0.35 + Math.sin(this.anim * 2 + i) * 0.08;
        addBoxYaw(verts, x + Math.cos(a) * r, y + ry, z + Math.sin(a) * r, 0, 0, 0,
          0.06, 0.22, 0.06, { all: Tt('blaze_skin') }, 1.6);
      }
      return;
    }
    if (k === 'pigman') {
      humanoid(Tt('pigman_face'), Tt('pigman_skin'), Tt('zombie_shirt'), Tt('zombie_pants'), Tt('pigman_skin'));
      return;
    }
    if (k === 'zombie') humanoid(Tt('zombie_face'), Tt('zombie_skin'), Tt('zombie_shirt'), Tt('zombie_pants'), Tt('zombie_skin'));
    else if (k === 'skeleton') humanoid(Tt('skel_face'), Tt('skel_bone'), Tt('skel_bone'), Tt('skel_bone'), Tt('skel_bone'));
    else if (k === 'creeper') {
      const y = this.y;
      const flash = this.fuseT >= 0 && (Math.floor(this.fuseT * 8) % 2 === 0) ? 2.2 : l;
      for (const [ox, oz] of [[0.15, 0.2], [-0.15, 0.2], [0.15, -0.2], [-0.15, -0.2]])
        addBoxYaw(verts, x, y + 0.2, z, yaw, ox, oz, 0.12, 0.2, 0.1, { all: Tt('creeper_skin') }, flash);
      addBoxYaw(verts, x, y + 0.4 + 0.4, z, yaw, 0, 0, 0.22, 0.4, 0.15, { all: Tt('creeper_skin') }, flash);
      addBoxYaw(verts, x, y + 1.2 + 0.22, z, yaw, 0, 0, 0.22, 0.22, 0.22, { all: Tt('creeper_skin'), front: Tt('creeper_face') }, flash);
    } else if (k === 'spider') {
      const y = this.y;
      addBoxYaw(verts, x, y + 0.35, z, yaw, 0, -0.3, 0.35, 0.25, 0.35, { all: Tt('spider_skin') }, l);
      addBoxYaw(verts, x, y + 0.35, z, yaw, 0, 0.35, 0.22, 0.18, 0.22, { all: Tt('spider_skin'), front: Tt('spider_face') }, l);
      for (let i = 0; i < 4; i++) {
        const lz = -0.4 + i * 0.26;
        const lift = Math.sin(this.anim * 5 + i) * 0.1;
        addBoxYaw(verts, x, y + 0.3 + lift, z, yaw, 0.55, lz, 0.3, 0.04, 0.05, { all: Tt('spider_skin') }, l);
        addBoxYaw(verts, x, y + 0.3 - lift, z, yaw, -0.55, lz, 0.3, 0.04, 0.05, { all: Tt('spider_skin') }, l);
      }
    } else {
      // quadrupeds + chicken
      const bodyT = { cow: 'cow_body', pig: 'pig_skin', sheep: 'sheep_wool', chicken: 'chicken_body' }[k];
      const faceT = { cow: 'cow_face', pig: 'pig_face', sheep: 'sheep_face', chicken: 'chicken_face' }[k];
      const scale = k === 'chicken' ? 0.55 : 1;
      const y = this.y;
      const legH = 0.42 * scale, bodyH = 0.5 * scale;
      // legs
      const legPos = k === 'chicken' ? [[0.1, 0], [-0.1, 0]] : [[0.2, 0.32], [-0.2, 0.32], [0.2, -0.32], [-0.2, -0.32]];
      legPos.forEach(([ox, oz], i) => {
        limb(verts, x, y + legH, z, yaw, ox, oz, 0.08 * scale + 0.03, 0.08 * scale + 0.03, legH, Tt(k === 'chicken' ? 'chicken_face' : bodyT), l, (i % 2 ? swing : -swing) * 0.8);
      });
      // body
      addBoxYaw(verts, x, y + legH + bodyH / 2, z, yaw, 0, 0, 0.33 * scale + 0.08, bodyH / 2, 0.5 * scale, { all: Tt(bodyT) }, l);
      // head
      addBoxYaw(verts, x, y + legH + bodyH + 0.1 * scale, z, yaw, 0, 0.5 * scale + 0.1, 0.2 * scale + 0.05, 0.2 * scale + 0.05, 0.2 * scale + 0.05, { all: Tt(bodyT), front: Tt(faceT) }, l);
    }
  }
}


// ---------------------------------------------------------------- body plans
// A handful of shapes, each reading the mob's own width/height, so most of the
// roster draws itself from its size and its two skin tiles alone. The older
// hand-built creatures (creeper, spider, ghast, ...) keep their own branches.
const PLANS = {
  // four legs, a barrel body and a head out front: cows through ravagers
  quad(m, verts, l, yaw, swing) {
    const skin = TileIdx[m.kind + '_skin'], face = TileIdx[m.kind + '_face'];
    const x = m.x, y = m.y, z = m.z, w = m.w, h = m.h;
    // curled up: an armadillo is just a ball with plates
    if (m.curl > 0) {
      addBoxYaw(verts, x, y + w, z, yaw, 0, 0, w * 1.1, w * 1.05, w * 1.1, { all: skin }, l);
      return;
    }
    const legH = h * 0.4, bodyH = h * 0.36, hr = Math.min(w * 0.8, h * 0.22);
    const bx = w * 0.78, bz = w * 1.25;
    const legs = [[bx * 0.7, bz * 0.6], [-bx * 0.7, bz * 0.6], [bx * 0.7, -bz * 0.6], [-bx * 0.7, -bz * 0.6]];
    legs.forEach(([ox, oz], i) =>
      limb(verts, x, y + legH, z, yaw, ox, oz, w * 0.22, w * 0.22, legH, skin, l, (i % 2 ? swing : -swing) * 0.8));
    addBoxYaw(verts, x, y + legH + bodyH / 2, z, yaw, 0, 0, bx, bodyH / 2, bz, { all: skin }, l);
    // head, dipped toward the ground while grazing
    const dip = m.def.hostile || m.angry ? 0 : Math.sin(m.age * 0.5) * 0.06;
    addBoxYaw(verts, x, y + legH + bodyH + hr * 0.5 - dip, z, yaw, 0, bz + hr * 0.7, hr, hr, hr,
      { all: skin, front: face }, l);
    // tail
    addBoxYaw(verts, x, y + legH + bodyH * 0.8, z, yaw, 0, -bz - w * 0.15, w * 0.12, w * 0.12, w * 0.2, { all: skin }, l);
  },

  // two arms, two legs, a cube head: villagers, illagers, golems, the warden
  humanoid(m, verts, l, yaw, swing) {
    const skin = TileIdx[m.kind + '_skin'], face = TileIdx[m.kind + '_face'];
    const cloth = TileIdx[m.kind + '_cloth'] ?? skin;     // robes, coats, armour
    const x = m.x, y = m.y, h = m.h, z = m.z;
    const s = h / 1.8, t = Math.max(0.1, m.w * 0.36);
    const legH = 0.75 * s, bodyH = 0.75 * s, headR = 0.25 * s * (m.w > 0.45 ? 1.25 : 1);
    // arms forward for the shamblers, swinging for everyone else
    const lunge = m.def.burns || m.def.watched || m.def.sonic ? -1.35 : swing;
    limb(verts, x, y + legH, z, yaw, t * 0.9, 0, t * 0.75, t * 0.75, legH, cloth, l, swing);
    limb(verts, x, y + legH, z, yaw, -t * 0.9, 0, t * 0.75, t * 0.75, legH, cloth, l, -swing);
    addBoxYaw(verts, x, y + legH + bodyH / 2, z, yaw, 0, 0, t * 1.75, bodyH / 2, t, { all: cloth }, l);
    limb(verts, x, y + legH + bodyH * 0.9, z, yaw, t * 2.4, 0, t * 0.7, t * 0.7, bodyH * 0.9, skin, l, lunge);
    limb(verts, x, y + legH + bodyH * 0.9, z, yaw, -t * 2.4, 0, t * 0.7, t * 0.7, bodyH * 0.9, skin, l,
      lunge === swing ? -swing : lunge);
    addBoxYaw(verts, x, y + legH + bodyH + headR, z, yaw, 0, 0, headR, headR, headR,
      { all: skin, front: face }, l);
  },

  // a small body, a head and a pair of beating wings
  flyer(m, verts, l, yaw) {
    const skin = TileIdx[m.kind + '_skin'], face = TileIdx[m.kind + '_face'];
    const x = m.x, y = m.y, z = m.z, w = m.w, h = m.h;
    const flap = Math.sin(m.anim * 16) * 0.5;
    addBoxYaw(verts, x, y + h * 0.45, z, yaw, 0, 0, w, h * 0.3, w * 1.2, { all: skin }, l);
    addBoxYaw(verts, x, y + h * 0.8, z, yaw, 0, w * 1.1, w * 0.8, w * 0.8, w * 0.8,
      { all: skin, front: face }, l);
    for (const side of [1, -1]) {
      const span = w * 2.6;
      addBoxYaw(verts, x, y + h * 0.55 + flap * w * 1.6, z, yaw, side * (w + span * 0.5), -w * 0.2,
        span * 0.5, w * 0.16, w * 1.1, { all: skin }, l * (flap > 0 ? 1 : 0.82));
    }
    // and a tail to steady it
    addBoxYaw(verts, x, y + h * 0.45, z, yaw, 0, -w * 1.5, w * 0.3, w * 0.08, w * 0.5, { all: skin }, l);
  },

  // a soft cube that squashes as it lands: slimes and magma cubes
  blob(m, verts, l, yaw) {
    const skin = TileIdx[m.kind + '_skin'], face = TileIdx[m.kind + '_face'];
    const squash = m.onGround ? 1 + Math.max(0, Math.min(0.35, -m.vy * 0.04)) : 0.88;
    const r = m.w * 1.05;
    addBoxYaw(verts, m.x, m.y + r / squash, m.z, yaw, 0, 0, r * squash, r / squash, r * squash,
      { all: skin, front: face }, l);
    // the little core sloshing inside
    addBoxYaw(verts, m.x, m.y + r * 0.7, m.z, yaw, 0, 0, r * 0.45, r * 0.45, r * 0.45,
      { all: skin }, Math.min(1.6, l * 1.4));
  },

  // a streamlined body with a waving tail: fish, dolphins, guardians
  fishy(m, verts, l, yaw) {
    const skin = TileIdx[m.kind + '_skin'], face = TileIdx[m.kind + '_face'];
    const x = m.x, y = m.y, z = m.z, w = m.w, h = m.h;
    const wag = Math.sin(m.anim * 8) * w * 0.9;
    addBoxYaw(verts, x, y + h * 0.5, z, yaw, 0, 0, w, h * 0.5, w * 1.6, { all: skin, front: face }, l);
    addBoxYaw(verts, x + wag * Math.cos(yaw), y + h * 0.5, z - wag * Math.sin(yaw), yaw,
      0, -w * 2.1, w * 0.12, h * 0.45, w * 0.7, { all: skin }, l);
    // dorsal fin
    addBoxYaw(verts, x, y + h * 1.05, z, yaw, 0, 0, w * 0.1, h * 0.25, w * 0.5, { all: skin }, l);
    // guardians run a spine of spikes instead of pectoral fins
    if (m.def.laser)
      for (const side of [1, -1])
        addBoxYaw(verts, x, y + h * 0.5, z, yaw, side * w * 1.2, 0, w * 0.35, h * 0.1, w * 0.1, { all: skin }, l);
  },

  // a mantle and eight drifting arms
  squid(m, verts, l, yaw) {
    const skin = TileIdx[m.kind + '_skin'], face = TileIdx[m.kind + '_face'];
    const x = m.x, y = m.y, z = m.z, w = m.w, h = m.h;
    addBoxYaw(verts, x, y + h * 0.68, z, yaw, 0, 0, w, h * 0.34, w, { all: skin, front: face }, l);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sway = Math.sin(m.anim * 3 + i) * w * 0.25;
      addBoxYaw(verts, x + Math.cos(a) * w * 0.55 + sway, y + h * 0.18, z + Math.sin(a) * w * 0.55, yaw,
        0, 0, w * 0.12, h * 0.2, w * 0.12, { all: skin }, l);
    }
  },

  // low, many-legged and quick: cave spiders, silverfish, endermites
  arthro(m, verts, l, yaw) {
    const skin = TileIdx[m.kind + '_skin'], face = TileIdx[m.kind + '_face'];
    const x = m.x, y = m.y, z = m.z, w = m.w, h = m.h;
    addBoxYaw(verts, x, y + h * 0.5, z, yaw, 0, -w * 0.3, w, h * 0.45, w * 1.1, { all: skin }, l);
    addBoxYaw(verts, x, y + h * 0.55, z, yaw, 0, w * 0.95, w * 0.65, w * 0.55, w * 0.6,
      { all: skin, front: face }, l);
    for (let i = 0; i < 3; i++) {
      const oz = -w * 0.6 + i * w * 0.7;
      const lift = Math.sin(m.anim * 7 + i) * h * 0.12;
      for (const side of [1, -1])
        addBoxYaw(verts, x, y + h * 0.3 + lift * side, z, yaw, side * w * 1.5, oz,
          w * 0.7, h * 0.06, w * 0.08, { all: skin }, l);
    }
  },

  // a shell bolted to the world that cracks open to shoot
  cube(m, verts, l, yaw) {
    const skin = TileIdx[m.kind + '_skin'], face = TileIdx[m.kind + '_face'];
    const r = m.w;
    addBoxYaw(verts, m.x, m.y + r, m.z, yaw, 0, 0, r, r, r, { all: skin }, l);
    const peek = (m.open ?? 0) * r * 0.8;
    if (peek > 0.01)
      addBoxYaw(verts, m.x, m.y + r * 1.4 + peek, m.z, yaw, 0, 0, r * 0.55, r * 0.55, r * 0.55,
        { all: skin, front: face }, Math.min(1.6, l * 1.3));
  },

  // the ghast silhouette, reused by its friendly cousin
  ghastly(m, verts, l, yaw) {
    const skin = TileIdx[m.kind + '_skin'], face = TileIdx[m.kind + '_face'];
    addBoxYaw(verts, m.x, m.y + 2.1, m.z, yaw, 0, 0, 1.6, 1.6, 1.6, { all: skin, front: face },
      Math.max(l, 0.75));
    for (let i = 0; i < 9; i++) {
      const ox = ((i % 3) - 1) * 0.9, oz = (((i / 3) | 0) - 1) * 0.9;
      const len = 0.7 + ((i * 7) % 5) * 0.22;
      const sway = Math.sin(m.anim * 1.6 + i) * 0.1;
      addBoxYaw(verts, m.x + sway, m.y + 0.5 - len / 2 + 0.1, m.z, yaw, ox, oz, 0.16, len / 2, 0.16,
        { all: skin }, Math.max(l, 0.6));
    }
  },
};

// ---------------------------------------------------------------- box builders
// axis order helpers for rotated boxes (rotation around Y at (cx, cz))
function addBoxYaw(verts, wx, wy, wz, yaw, ox, oz, hx, hy, hz, tiles, light) {
  // center at (wx + rotated(ox, oz), wy)
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cx2 = wx + ox * cy + oz * sy;
  const cz2 = wz - ox * sy + oz * cy;
  emitEntityBox(verts, cx2, wy, cz2, hx, hy, hz, yaw, tiles, light);
}
// limb with swing rotation around pivot (top of the limb)
function limb(verts, wx, pivotY, wz, yaw, ox, oz, hx, hz, len, tile, light, angle) {
  // limb extends downward from pivot; rotate around X-ish axis (in facing space)
  const ca = Math.cos(angle), sa = Math.sin(angle);
  // center in local space before yaw
  const lx = ox;
  const ly = -len / 2 * ca;
  const lz = oz + len / 2 * sa;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cx2 = wx + lx * cy + lz * sy;
  const cz2 = wz - lx * sy + lz * cy;
  emitEntityBox(verts, cx2, pivotY + ly - len / 2 * (1 - ca) * 0 - len / 2 * 0, cz2, hx, len / 2, hz, yaw, { all: tile }, light, ly + len / 2);
}
function emitEntityBox(verts, cx, cy0, cz, hx, hy, hz, yaw, tiles, light, yAdjust) {
  // cy0 = center y (already positioned)
  const cy = yAdjust !== undefined ? cy0 : cy0;
  const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
  const rot = (x, z) => [x * cyaw + z * syaw, -x * syaw + z * cyaw];
  for (let fi = 0; fi < 6; fi++) {
    const f = FACES[fi];
    let ti = tiles.all !== undefined ? tiles.all : tiles.side;
    if (tiles.front !== undefined && fi === 4) ti = tiles.front;
    if (tiles.top !== undefined && fi === 0) ti = tiles.top;
    const shade = f.shade;
    const vtx = [];
    for (let i = 0; i < 4; i++) {
      const p = f.c[i];
      const lx = (p[0] * 2 - 1) * hx, lyy = (p[1] * 2 - 1) * hy, lz = (p[2] * 2 - 1) * hz;
      const [rx, rz] = rot(lx, lz);
      const [u, v] = tileUVc(ti, UVQ[i][0], UVQ[i][1]);
      vtx.push([cx + rx, cy + lyy, cz + rz, u, v, light * shade, 0]);
    }
    pushQuad(verts, vtx);
  }
}
function addBox(verts, cx, cy, cz, hx, hy, hz, yaw, tiles, light) {
  emitEntityBox(verts, cx, cy + hy, cz, hx, hy, hz, yaw,
    { top: tiles.top, side: tiles.side, front: tiles.front }, light);
}
function addSprite(verts, cx, cy, cz, half, yaw, tile, light) {
  const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
  for (const flip of [1, -1]) {
    const vtx = [];
    const corners = flip === 1 ? [[-1, 0], [1, 0], [1, 2], [-1, 2]] : [[1, 0], [-1, 0], [-1, 2], [1, 2]];
    for (let i = 0; i < 4; i++) {
      const [cxs, cys] = corners[i];
      const dx = cxs * half * cyaw, dz = -cxs * half * syaw;
      const [u, v] = tileUVc(tile, (cxs + 1) / 2, 1 - cys / 2);
      vtx.push([cx + dx, cy + cys * half, cz + dz, u, v, light, 0]);
    }
    pushQuad(verts, vtx);
  }
}

// ---------------------------------------------------------------- particles
class Particles {
  constructor() { this.list = []; }
  burst(x, y, z, tile, n, speed = 3, spread = 0) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        x: x + (spread ? rand(-spread, spread) : 0),
        y: y + (spread ? rand(-spread, spread) : 0),
        z: z + (spread ? rand(-spread, spread) : 0),
        vx: rand(-speed, speed), vy: rand(0.5, speed + 1.5), vz: rand(-speed, speed),
        life: rand(0.3, 0.8), tile,
        u: Math.random() * 0.7, v: Math.random() * 0.7,
        size: rand(0.04, 0.09),
      });
    }
    if (this.list.length > 400) this.list.splice(0, this.list.length - 400);
  }
  update(world, dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy -= 16 * dt;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
      const id = world.getBlock(nx, ny, nz);
      if (id && Blocks[id].solid) { p.vx *= -0.3; p.vy *= -0.3; p.vz *= -0.3; }
      else { p.x = nx; p.y = ny; p.z = nz; }
    }
  }
  emit(verts, cam, world) {
    for (const p of this.list) {
      const l = Math.max(0.3, world.skyAt(p.x, p.y, p.z));
      // camera-facing quad
      const yaw = cam.yaw;
      const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
      const [tx, ty] = tileXY(p.tile);
      const u0 = (tx + p.u * TILE) / ATLAS_PX, v0 = (ty + p.v * TILE) / ATLAS_PX;
      const us = 4 / ATLAS_PX;
      const s = p.size;
      const vtx = [];
      const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let i = 0; i < 4; i++) {
        const [a, b2] = cs[i];
        vtx.push([p.x + a * s * cyaw, p.y + b2 * s, p.z - a * s * syaw,
          u0 + (a + 1) / 2 * us, v0 + (b2 + 1) / 2 * us, l, 0]);
      }
      pushQuad(verts, vtx);
    }
  }
}
