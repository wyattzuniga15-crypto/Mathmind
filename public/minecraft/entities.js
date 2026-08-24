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

// ---------------------------------------------------------------- mobs
const MOB_DEFS = {
  zombie: { hp: 20, speed: 2.1, hostile: true, dmg: 3, burns: true,
    drops: () => [[I.rotten_flesh, randInt(0, 2)]] },
  skeleton: { hp: 20, speed: 2.2, hostile: true, dmg: 0, ranged: true, burns: true,
    drops: () => [[I.bone, randInt(0, 2)], [I.arrow, randInt(0, 2)]] },
  creeper: { hp: 20, speed: 2.4, hostile: true, dmg: 0, fuse: true,
    drops: () => [[I.gunpowder, randInt(0, 2)]] },
  spider: { hp: 16, speed: 2.6, hostile: true, dmg: 2, night: true,
    drops: () => [[I.string, randInt(0, 2)]] },
  cow: { hp: 10, speed: 1.2, hostile: false,
    drops: () => [[I.beef, randInt(1, 3)], [I.leather, randInt(0, 2)]] },
  pig: { hp: 10, speed: 1.2, hostile: false,
    drops: () => [[I.porkchop, randInt(1, 3)]] },
  sheep: { hp: 8, speed: 1.15, hostile: false,
    drops: () => [[B.wool, randInt(1, 2)]] },
  chicken: { hp: 4, speed: 1.1, hostile: false,
    drops: () => [[I.chicken, 1], [I.feather, randInt(0, 2)]] },
};

class Mob extends Entity {
  constructor(kind, x, y, z) {
    super(x, y, z);
    this.kind = kind;
    const d = MOB_DEFS[kind];
    this.hp = d.hp; this.maxHp = d.hp;
    this.def = d;
    this.w = kind === 'chicken' ? 0.22 : kind === 'spider' ? 0.6 : 0.32;
    this.h = kind === 'chicken' ? 0.7 : kind === 'spider' ? 0.8 : 1.8;
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
    if (this.hurtT > 0.3) { }
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
    if (this.def.hostile) game.stats.kills++;
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

    let targeting = false;
    if (this.def.hostile && !p.dead && d2p < 20 * 20) {
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
      } else {
        this.moveX = dx / dl; this.moveZ = dz / dl;
        if (d2p < 2.2 && this.attackCd <= 0) {
          this.attackCd = 1;
          p.hurt(game, this.def.dmg, dx / dl * 0.5, dz / dl * 0.5);
        }
      }
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
    const sp = this.def.speed * (targeting && !this.def.ranged ? 1.15 : 0.6) * (targeting ? 1.4 : 1);
    this.vx = lerp(this.vx, this.moveX * sp, 0.12);
    this.vz = lerp(this.vz, this.moveZ * sp, 0.12);
    // jump over obstacles
    if ((this.moveX || this.moveZ) && this.onGround) {
      const ahead = world.getBlock(this.x + this.moveX * 0.8, this.y + 0.4, this.z + this.moveZ * 0.8);
      if (ahead && Blocks[ahead].solid) this.vy = 8.2;
      else if (this.inWater) this.vy = 3;
    }
    if (this.inWater && (this.moveX || this.moveZ)) this.vy = Math.max(this.vy, 1.5);
    this.physics(world, dt);
    this.anim += Math.hypot(this.vx, this.vz) * dt * 3.2;
    if (this.y < -10) this.dead = true;
    // cactus / lava damage
    const at = world.getBlock(this.x, this.y, this.z);
    if (at === B.lava) this.hurt(game, 4);
  }
  explode(game) {
    this.dead = true;
    game.explode(this.x, this.y + 0.5, this.z, 2.6, 24);
  }
  canSee(game, p) {
    const ex = this.x, ey = this.y + 1.4, ez = this.z;
    const dx = p.x - ex, dy = (p.y + 1.4) - ey, dz = p.z - ez;
    const d = Math.hypot(dx, dy, dz) || 1;
    const hit = game.world.raycast(ex, ey, ez, dx / d, dy / d, dz / d, d);
    return !hit;
  }
  emit(verts, game) {
    const l0 = Math.max(0.12, game.world.skyAt(this.x, this.y + 1, this.z));
    const l = this.hurtT > 0.35 ? 1.6 : l0;   // flash when hurt
    const yaw = this.yaw;
    const swing = Math.sin(this.anim * 4) * 0.5;
    const k = this.kind, x = this.x, z = this.z;
    const Tt = (n) => TileIdx[n];
    const humanoid = (skinFace, skinSide, shirt, pants, armT) => {
      const y = this.y;
      // legs
      limb(verts, x, y + 0.75, z, yaw, 0.13, 0, 0.12, 0.12, 0.75, pants, l, swing);
      limb(verts, x, y + 0.75, z, yaw, -0.13, 0, 0.12, 0.12, 0.75, pants, l, -swing);
      // body
      addBoxYaw(verts, x, y + 0.75 + 0.375, z, yaw, 0, 0, 0.26, 0.375, 0.15, { all: shirt }, l);
      // arms (zombie holds arms forward)
      const armAng = this.def.hostile && k === 'zombie' ? -1.4 : swing;
      limb(verts, x, y + 1.42, z, yaw, 0.36, 0, 0.1, 0.1, 0.68, armT, l, armAng);
      limb(verts, x, y + 1.42, z, yaw, -0.36, 0, 0.1, 0.1, 0.68, armT, l, k === 'zombie' ? armAng : -swing);
      // head
      addBoxYaw(verts, x, y + 1.5 + 0.25, z, yaw, 0, 0, 0.25, 0.25, 0.25, { all: skinSide, front: skinFace }, l);
    };
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
      vtx.push([cx + rx, cy + lyy, cz + rz, u, v, light * shade]);
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
      vtx.push([cx + dx, cy + cys * half, cz + dz, u, v, light]);
    }
    pushQuad(verts, vtx);
  }
}

// ---------------------------------------------------------------- particles
class Particles {
  constructor() { this.list = []; }
  burst(x, y, z, tile, n, speed = 3) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        x, y, z,
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
          u0 + (a + 1) / 2 * us, v0 + (b2 + 1) / 2 * us, l]);
      }
      pushQuad(verts, vtx);
    }
  }
}
