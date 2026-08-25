'use strict';
// ---------------------------------------------------------------- The End's boss fight
// End crystals perch on the obsidian pillars and pour health back into the
// dragon; break them all, then bring the dragon down to finish the game.

class EndCrystal extends Entity {
  constructor(x, y, z) {
    super(x, y, z);
    this.w = 0.5; this.h = 1.4;
    this.hp = 5;
    this.beamT = 0;
  }
  hurt(game) {
    if (this.dead) return;
    this.dead = true;
    game.explode(this.x, this.y + 0.7, this.z, 2.0, 10);
    game.particles.burst(this.x, this.y + 0.7, this.z, TileIdx.crystal, 26, 5);
    Sfx.crystal();
    const left = game.crystals.filter(c => !c.dead).length;
    game.msg(left ? `End crystal destroyed — ${left} left` : 'All crystals destroyed!');
  }
  update(game, dt) {
    this.age += dt;
    this.beamT -= dt;
  }
  emit(verts, game) {
    const bob = Math.sin(this.age * 1.6) * 0.14;
    const spin = this.age * 1.1;
    // the crystal itself, with its cage of light
    addBox(verts, this.x, this.y + 0.6 + bob, this.z, 0.42, 0.42, 0.42, spin, {
      top: TileIdx.crystal, side: TileIdx.crystal, front: TileIdx.crystal,
    }, 1.6);
    addBox(verts, this.x, this.y + 0.62 + bob, this.z, 0.26, 0.55, 0.26, -spin * 1.6, {
      top: TileIdx.crystal, side: TileIdx.crystal, front: TileIdx.crystal,
    }, 1.9);
  }
}

// ---------------------------------------------------------------- the Ender Dragon
class EnderDragon extends Entity {
  constructor() {
    super(0, END_Y + 34, 0);
    this.w = 3.2; this.h = 2.4;
    this.maxHp = 160; this.hp = 160;
    this.angle = 0;                 // position around the island
    this.radius = 38;
    this.phase = 'circle';          // circle | charge | perch
    this.phaseT = 6;
    this.yaw = 0; this.pitch = 0;
    this.hurtT = 0;
    this.breathCd = 4;
    this.wing = 0;
    this.dying = 0;
  }

  hurt(game, dmg) {
    if (this.dying) return;
    const shielded = game.crystals.some(c => !c.dead);
    if (shielded) {
      // the crystals hold it together — hitting it does nothing but sparks
      game.particles.burst(this.x, this.y, this.z, TileIdx.crystal, 6, 2);
      if (!this._warned || performance.now() - this._warned > 4000) {
        this._warned = performance.now();
        game.msg('The crystals are healing it — destroy them first!');
      }
      return;
    }
    this.hp -= dmg;
    this.hurtT = 0.4;
    Sfx.dragon();
    UI.refreshBoss(this);
    if (this.hp <= 0) this.die(game);
  }

  die(game) {
    this.dying = 4.5;
    this.hp = 0;
    Sfx.dragon();
    game.msg('The Ender Dragon is falling!');
  }

  update(game, dt) {
    this.age += dt; this.hurtT -= dt; this.breathCd -= dt;
    this.wing += dt * (this.phase === 'charge' ? 7 : 3.4);
    const p = game.player;

    // death throes: rise, wreathed in light, then burst
    if (this.dying > 0) {
      this.dying -= dt;
      this.y += dt * 2.4;
      this.pitch = lerp(this.pitch, -0.5, 0.05);
      if (Math.random() < 0.7)
        game.particles.burst(this.x + rand(-3, 3), this.y + rand(-1, 2), this.z + rand(-3, 3), TileIdx.crystal, 3, 3);
      if (this.dying <= 0) {
        this.dead = true;
        game.particles.burst(this.x, this.y, this.z, TileIdx.crystal, 90, 9);
        Sfx.explosion();
        game.onDragonSlain();
      }
      return;
    }

    // crystals pour health back in
    let healed = false;
    for (const c of game.crystals) {
      if (c.dead) continue;
      if (dist2(c.x, c.y, c.z, this.x, this.y, this.z) < 70 * 70) {
        this.hp = Math.min(this.maxHp, this.hp + 3 * dt);
        healed = true;
        if (Math.random() < 0.25 * dt * 60 / 60) {
          const t = Math.random();
          game.particles.burst(lerp(c.x, this.x, t), lerp(c.y + 1, this.y, t), lerp(c.z, this.z, t),
            TileIdx.crystal, 1, 0.4);
        }
      }
    }
    this.healed = healed;

    this.phaseT -= dt;
    if (this.phaseT <= 0) {
      if (this.phase === 'circle') {
        // dive at the player, or settle on the portal to catch its breath
        this.phase = Math.random() < 0.6 ? 'charge' : 'perch';
        this.phaseT = this.phase === 'charge' ? 6 : 7;
      } else { this.phase = 'circle'; this.phaseT = rand(7, 11); }
    }

    let tx, ty, tz;
    if (this.phase === 'circle') {
      this.angle += dt * 0.42;
      tx = Math.cos(this.angle) * this.radius;
      tz = Math.sin(this.angle) * this.radius;
      ty = END_Y + 30 + Math.sin(this.age * 0.5) * 5;
    } else if (this.phase === 'charge') {
      tx = p.x; ty = p.y + 2.2; tz = p.z;
    } else {
      tx = 0; tz = 0; ty = END_Y + 8;
    }

    const dx = tx - this.x, dy = ty - this.y, dz = tz - this.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const sp = this.phase === 'charge' ? 15 : 9;
    this.vx = lerp(this.vx, dx / d * sp, 0.03);
    this.vy = lerp(this.vy, dy / d * sp * 0.6, 0.03);
    this.vz = lerp(this.vz, dz / d * sp, 0.03);
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
    if (this.y < END_Y + 3) this.y = END_Y + 3;
    this.yaw = Math.atan2(this.vx, this.vz);
    this.pitch = lerp(this.pitch, clamp(-this.vy * 0.06, -0.5, 0.5), 0.05);

    // swiping the player aside
    if (!p.dead && dist2(this.x, this.y, this.z, p.x, p.y + 1, p.z) < 25) {
      if ((this.hitCd = (this.hitCd || 0) - dt) <= 0) {
        this.hitCd = 1.2;
        const kx = (p.x - this.x) || 0.1, kz = (p.z - this.z) || 0.1;
        const kl = Math.hypot(kx, kz);
        p.hurt(game, 6, kx / kl * 1.4, kz / kl * 1.4);
      }
    }
    // dragon's breath
    if (this.breathCd <= 0 && !p.dead && dist2(this.x, this.y, this.z, p.x, p.y, p.z) < 55 * 55) {
      this.breathCd = rand(5, 9);
      const ex = this.x, ey = this.y - 0.4, ez = this.z;
      const bx = p.x - ex, by = (p.y + 1) - ey, bz = p.z - ez;
      const bd = Math.hypot(bx, by, bz) || 1;
      for (let i = 0; i < 5; i++) {
        const j = 0.05 * i;
        game.fireballs.push(new Fireball(ex, ey, ez,
          (bx / bd + rand(-j, j)) * 16, (by / bd + rand(-j, j)) * 16, (bz / bd + rand(-j, j)) * 16, 0));
      }
      Sfx.fireball();
    }
    UI.refreshBoss(this);
  }

  // the dragon is a chain of boxes: head, neck, body, tail, plus beating wings
  emit(verts, game) {
    const l = this.hurtT > 0 ? 2.0 : 1.0;
    const skin = TileIdx.dragon_skin, face = TileIdx.dragon_face, wing = TileIdx.dragon_wing;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    // local +z is forward
    const at = (fwd, up, side) => [
      this.x + sy * fwd + cy * side,
      this.y + up + fwd * Math.sin(this.pitch) * 0.6,
      this.z + cy * fwd - sy * side,
    ];
    const seg = (fwd, up, hx, hy, hz, tile, side = 0, lift = 0) => {
      const [px, py, pz] = at(fwd, up + lift, side);
      emitEntityBox(verts, px, py, pz, hx, hy, hz, this.yaw, { all: tile }, l);
    };
    seg(0, 0, 1.9, 1.3, 2.8, skin);                    // body
    seg(3.2, 0.5, 1.0, 0.85, 1.2, skin);               // neck
    seg(4.9, 0.85, 0.8, 0.7, 0.9, skin);               // throat
    const [hx2, hy2, hz2] = at(6.4, 1.0, 0);
    emitEntityBox(verts, hx2, hy2, hz2, 1.15, 0.95, 1.45, this.yaw, { all: skin, front: face }, l);
    // jaw slung under the head
    const [jx, jy, jz] = at(6.6, 0.25, 0);
    emitEntityBox(verts, jx, jy, jz, 0.85, 0.28, 1.15, this.yaw, { all: skin }, l * 0.85);
    // tail tapering back, swaying as it flies
    for (let i = 1; i <= 5; i++) {
      const t = 1 - i * 0.15;
      const wag = Math.sin(this.age * 2 - i * 0.55) * 0.55 * i;
      seg(-2.9 - i * 1.7, 0.15, 0.7 * t, 0.62 * t, 1.0 * t, skin, wag);
    }
    // wings: three tapering panels a side, beating and tilting as they go
    const flap = Math.sin(this.wing);
    for (const sgn of [1, -1]) {
      for (let i = 1; i <= 3; i++) {
        const spread = 1.4 + i * 2.1;
        const up = flap * i * 0.75;
        const chord = 2.0 - i * 0.42;
        seg(0.6 - i * 0.5, 0.75, 2.1 - i * 0.15, 0.11, chord, wing, sgn * spread, up);
      }
      // the leading spar
      seg(1.4, 0.8, 0.16, 0.16, 3.6, skin, sgn * 3.6, flap * 1.5);
    }
  }
}
