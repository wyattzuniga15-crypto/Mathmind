'use strict';
// ---------------------------------------------------------------- player

class Player extends Entity {
  constructor(x, y, z) {
    super(x, y, z);
    this.w = 0.3; this.h = 1.8;
    this.eye = 1.62;
    this.yaw = 0; this.pitch = 0;
    this.hp = 20; this.maxHp = 20;
    this.xp = 0;
    this.hunger = 20; this.saturation = 5;
    this.air = 10; this.maxAir = 10;
    this.dead = false;
    this.sprinting = false; this.sneaking = false;
    this.fallStart = null;
    this.mining = null;       // {x,y,z,progress,time}
    this.swing = 0;           // arm swing anim
    this.hurtCd = 0;
    this.eatT = 0;            // eating progress
    this.exhaustion = 0;
    this.regenT = 0; this.starveT = 0; this.airT = 0;
    this.bob = 0;
    this.spawn = { x, y, z };
  }

  headInWater(world) {
    return world.getBlock(this.x, this.y + this.eye, this.z) === B.water;
  }

  update(game, dt, input) {
    if (this.dead) return;
    const world = game.world;
    this.hurtCd -= dt;

    // ---- movement intent ----
    let fw = 0, st = 0;
    if (input.key('KeyW')) fw += 1;
    if (input.key('KeyS')) fw -= 1;
    if (input.key('KeyA')) st -= 1;
    if (input.key('KeyD')) st += 1;
    if (input.analog) {
      fw = clamp(input.analog.fw, -1, 1);
      st = clamp(input.analog.st, -1, 1);
      if (input.analog.sprint && fw > 0.5 && this.hunger > 6) this.sprinting = true;
    }
    this.sneaking = input.key('ShiftLeft') || input.key('ShiftRight');
    if (input.key('ControlLeft') && fw > 0 && this.hunger > 6) this.sprinting = true;
    if (fw <= 0 || this.sneaking || this.hunger <= 6) this.sprinting = false;

    const inWater = world.getBlock(this.x, this.y + 0.4, this.z) === B.water;
    let speed = 4.3;
    if (this.sprinting) speed *= 1.55;
    if (this.sneaking) speed *= 0.35;
    if (inWater) speed *= 0.55;
    if (this.eatT > 0) speed *= 0.5;

    const siny = Math.sin(this.yaw), cosy = Math.cos(this.yaw);
    let mx = -siny * fw + cosy * st;
    let mz = -cosy * fw - siny * st;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }

    if (world.getBlock(this.x, this.y - 0.2, this.z) === B.soul_sand) speed *= 0.45;
    const onIce = world.getBlock(this.x, this.y - 0.5, this.z) === B.ice;
    const accel = this.onGround ? (onIce ? 2.5 : 22) : 5.5;
    this.vx = lerp(this.vx, mx * speed, clamp(accel * dt, 0, 1));
    this.vz = lerp(this.vz, mz * speed, clamp(accel * dt, 0, 1));

    // creative flight: double-tap jump to take off, then rise and sink freely
    if (game.creative) {
      const jump = input.key('Space');
      if (jump && !this._jumpWas) {
        const now = performance.now();
        if (now - (this._lastJump || 0) < 320) { this.flying = !this.flying; this.vy = 0; }
        this._lastJump = now;
      }
      this._jumpWas = jump;
      if (this.onGround && this.vy <= 0 && !jump) this.flying = false;
      if (this.flying) {
        const down = this.sneaking;
        this.vy = jump ? 8 : down ? -8 : this.vy * 0.75;
        speed *= 1.6;
      }
    } else this.flying = false;

    // jump / swim
    if (input.key('Space') && !this.flying) {
      if (inWater) this.vy = Math.min(this.vy + 26 * dt, 3.6);
      else if (this.onGround) {
        this.vy = 8.4;
        this.exhaustion += this.sprinting ? 0.2 : 0.05;
        this.onGround = false;
      }
    }

    // sneak edge-guard: don't walk off blocks while sneaking
    if (this.sneaking && this.onGround) {
      const tryX = this.x + this.vx * dt, tryZ = this.z + this.vz * dt;
      if (!world.boxCollides(tryX - this.w, this.y - 0.4, this.z - this.w, tryX + this.w, this.y - 0.05, this.z + this.w)) this.vx = 0;
      if (!world.boxCollides(this.x - this.w, this.y - 0.4, tryZ - this.w, this.x + this.w, this.y - 0.05, tryZ + this.w)) this.vz = 0;
    }

    // ---- physics + fall damage ----
    const wasGround = this.onGround;
    const prevVy = this.vy;
    if (this.flying) {
      const step = (ax, v) => {
        const nx = this.x + (ax === 0 ? v : 0), ny = this.y + (ax === 1 ? v : 0), nz = this.z + (ax === 2 ? v : 0);
        if (!world.boxCollides(nx - this.w, ny, nz - this.w, nx + this.w, ny + this.h, nz + this.w)) {
          this.x = nx; this.y = ny; this.z = nz;
        }
      };
      step(0, this.vx * dt); step(1, this.vy * dt); step(2, this.vz * dt);
      this.onGround = false; this.fallStart = null;
    } else this.physics(world, dt);
    if (!this.onGround && this.fallStart === null && this.vy < 0) this.fallStart = this.y + -this.vy * 0; // set below
    if (this.vy < 0 && this.fallStart === null) this.fallStart = this.y - this.vy * dt;
    if (this.fallStart !== null && this.fallStart < this.y) this.fallStart = this.y;
    if (this.onGround && this.fallStart !== null) {
      const fall = this.fallStart - this.y;
      if (fall > 3.5 && !inWater && !this.inWater) {
        const dmg = Math.floor(fall - 3);
        if (dmg > 0) this.hurt(game, dmg, 0, 0, true);
      }
      this.fallStart = null;
    }
    if (inWater) this.fallStart = null;

    // Bedrock-style auto-jump
    if (this.onGround && !this.sneaking && !inWater && ml > 0) {
      const ax = this.x + mx * 0.65, az = this.z + mz * 0.65;
      const bAt = (dy) => { const id = world.getBlock(ax, this.y + dy, az); return id && Blocks[id].solid; };
      if (bAt(0.3) && !bAt(1.3) && !bAt(2.2)) {
        const wall = world.boxCollides(this.x + mx * 0.2 - this.w, this.y + 0.1, this.z + mz * 0.2 - this.w,
          this.x + mx * 0.2 + this.w, this.y + 0.6, this.z + mz * 0.2 + this.w);
        if (wall) this.vy = 8.4;
      }
    }

    // view bobbing + footsteps
    const hspeed = Math.hypot(this.vx, this.vz);
    if (this.onGround && hspeed > 0.5) {
      this.bob += dt * hspeed * 1.6;
      this.stepDist = (this.stepDist || 0) + hspeed * dt;
      if (this.stepDist > 2.3) {
        this.stepDist = 0;
        const ground = world.getBlock(this.x, this.y - 0.5, this.z);
        if (ground) Sfx.step(ground);
      }
    }

    // ---- hazards ----
    const feet = world.getBlock(this.x, this.y + 0.1, this.z);
    if (feet === B.lava || world.getBlock(this.x, this.y + 1, this.z) === B.lava) {
      if (this.hurtCd <= 0) this.hurt(game, 4, rand(-0.3, 0.3), rand(-0.3, 0.3));
    }
    if (feet === B.cactus || this.touchingCactus(world)) {
      if (this.hurtCd <= 0) this.hurt(game, 1, rand(-0.2, 0.2), rand(-0.2, 0.2));
    }
    if (this.y < -8) this.hurt(game, 6);

    // drowning
    if (this.headInWater(world)) {
      this.airT += dt;
      if (this.airT > 1) { this.airT = 0; this.air--; if (this.air < 0) { this.air = 0; this.hurt(game, 2); } }
    } else { this.air = this.maxAir; this.airT = 0; }

    // ---- hunger / regen ----
    if (game.creative) { this.hunger = 20; this.hp = this.maxHp; this.air = this.maxAir; }
    this.exhaustion += (this.sprinting ? 0.28 : 0.02) * dt * hspeed * 0.25;
    if (this.exhaustion > 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation--;
      else if (this.hunger > 0) this.hunger--;
    }
    if (this.hunger >= 18 && this.hp < this.maxHp) {
      this.regenT += dt;
      if (this.regenT > 3.5) { this.regenT = 0; this.hp = Math.min(this.maxHp, this.hp + 1); this.exhaustion += 2; }
    }
    if (this.hunger <= 0) {
      this.starveT += dt;
      if (this.starveT > 4) { this.starveT = 0; if (this.hp > 1) this.hurt(game, 1); }
    }

    // ---- bow charging ----
    const held = game.inv.held();
    const heldDef = held ? itemDef(held.id) : null;
    if (heldDef && held.id === I.bow) {
      if (input.mouseRight && game.inv.count(I.arrow) > 0) {
        this.bowCharge = Math.min(1, (this.bowCharge || 0) + dt);
      } else if (this.bowCharge > 0.15) {
        // release
        const look = input.aimRay || this.lookDir();
        const sp = 10 + this.bowCharge * 22;
        game.arrows.push(new Arrow(
          this.x + look[0] * 0.4, this.y + this.eye - 0.1, this.z + look[2] * 0.4,
          look[0] * sp, look[1] * sp + 0.5, look[2] * sp, true));
        Sfx.bow();
        this.bowCharge = 0;
        // consume one arrow
        for (let i = 0; i < 36; i++) {
          const s = game.inv.slots[i];
          if (s && s.id === I.arrow) { s.count--; if (s.count <= 0) game.inv.slots[i] = null; break; }
        }
        game.inv.damageHeld(game);
        UI.refreshHotbar();
      } else this.bowCharge = 0;
    } else this.bowCharge = 0;

    // ---- eating ----
    if (input.mouseRight && heldDef && heldDef.food && this.hunger < 20) {
      this.eatT += dt;
      if (Math.floor(this.eatT * 6) !== Math.floor((this.eatT - dt) * 6)) Sfx.eat();
      if (this.eatT > 1.4) {
        this.eatT = 0;
        this.hunger = Math.min(20, this.hunger + heldDef.food);
        this.saturation = Math.min(this.hunger, this.saturation + heldDef.food * 0.6);
        if (heldDef.rotten && Math.random() < 0.6) game.msg('You feel sick…');
        game.inv.consumeHeld();
        Sfx.burp();
      }
    } else this.eatT = 0;

    // ---- mining (aim from touch point when present, else the crosshair) ----
    const look = input.aimRay || this.lookDir();
    const hit = world.raycast(this.x, this.y + this.eye, this.z, look[0], look[1], look[2], 5);
    game.target = hit;
    if (input.mouseLeft && !input.uiOpen) {
      this.swing = 0.25;
      if (hit) {
        // attack mob takes precedence — handled in main via entity ray; mine block here
        if (!game.tryAttack(look)) {
          const key = hit.x + ',' + hit.y + ',' + hit.z;
          const heldId = held ? held.id : 0;
          let bt = breakTime(hit.id, heldId);
          if (game.creative && bt !== Infinity) bt = 0.05;
          if (bt === Infinity) { this.mining = null; }
          else {
            if (!this.mining || this.mining.key !== key) {
              this.mining = { key, x: hit.x, y: hit.y, z: hit.z, progress: 0, total: bt };
              this.digSndT = 0;
            }
            this.mining.progress += dt * (this.onGround ? 1 : 0.3) * (this.headInWater(world) ? 0.2 : 1);
            this.digSndT = (this.digSndT || 0) - dt;
            if (this.digSndT <= 0) {
              this.digSndT = 0.22;
              Sfx.dig(hit.id);
              // chips fly off the face being struck
              const bt = Blocks[hit.id].tiles;
              if (bt) game.particles.burst(
                hit.x + 0.5 + hit.face[0] * 0.56, hit.y + 0.5 + hit.face[1] * 0.56,
                hit.z + 0.5 + hit.face[2] * 0.56, bt.side, 3, 1.1, 0.3);
            }
            if (this.mining.progress >= this.mining.total) {
              game.breakBlock(hit.x, hit.y, hit.z, heldId);
              this.mining = null;
              this.exhaustion += 0.03;
            }
          }
        } else this.mining = null;
      } else this.mining = null;
    } else this.mining = null;

    // ---- placing / interacting (on press, handled via queued clicks) ----
    while (input.rightClicks.length) {
      input.rightClicks.pop();
      if (input.uiOpen) continue;
      if (held && held.id === I.eye_of_ender && !hit) { game.throwEye(); continue; }
      if (heldDef && heldDef.food && this.hunger < 20) continue; // eating instead
      if (hit) {
        const tid = hit.id;
        if (tid === B.crafting_table) { game.openCrafting(); continue; }
        if (tid === B.furnace || tid === B.furnace_lit) { game.openFurnace(hit.x, hit.y, hit.z); continue; }
        if (tid === B.chest) { game.openChest(hit.x, hit.y, hit.z); continue; }
        if (tid === B.bed) { game.sleep(hit.x, hit.y, hit.z); continue; }
        if (tid === B.tnt) { game.igniteTnt(hit.x, hit.y, hit.z); continue; }
        // flint and steel lights a portal frame (or sets netherrack alight)
        if (held && held.id === I.flint_and_steel) {
          if (tid === B.obsidian && game.lightPortal(hit.x, hit.y, hit.z)) {
            game.inv.damageHeld(game);
          } else {
            Sfx.dig(B.stone);
            game.particles.burst(hit.x + 0.5, hit.y + 1, hit.z + 0.5, TileIdx.fireball, 4, 1);
            game.inv.damageHeld(game);
          }
          continue;
        }
        // eyes of ender slot into portal frames; otherwise they are thrown
        if (held && held.id === I.eye_of_ender) {
          if (tid === B.end_portal_frame) game.fillFrame(hit.x, hit.y, hit.z);
          else game.throwEye();
          continue;
        }
        // plant seeds on top of grass/dirt
        if (held && held.id === I.wheat_seeds && hit.face[1] === 1 &&
            (tid === B.grass_block || tid === B.dirt || tid === B.farmland) &&
            world.getBlock(hit.x, hit.y + 1, hit.z) === 0) {
          game.placeBlock(hit.x, hit.y + 1, hit.z, B.wheat_crop);
          continue;
        }
        // place block
        if (held && held.id < 256 && held.id !== B.water && held.id !== B.lava) {
          const px = hit.x + hit.face[0], py = hit.y + hit.face[1], pz = hit.z + hit.face[2];
          if (py < 1 || py >= WORLD_H) continue;
          const cur = world.getBlock(px, py, pz);
          if (cur !== 0 && cur !== B.water && cur !== B.tall_grass) continue;
          const bdef = Blocks[held.id];
          // don't place inside self
          if (bdef.solid && px + 1 > this.x - this.w && px < this.x + this.w &&
              pz + 1 > this.z - this.w && pz < this.z + this.w &&
              py + 1 > this.y && py < this.y + this.h) continue;
          // support rules
          if ((bdef.rt === RT_CROSS || held.id === B.torch) && !Blocks[world.getBlock(px, py - 1, pz)].solid) continue;
          game.placeBlock(px, py, pz, held.id);
          this.swing = 0.25;
        }
      }
    }
    this.swing = Math.max(0, this.swing - dt);
  }

  touchingCactus(world) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (world.getBlock(this.x + dx * 0.45, this.y + 0.5, this.z + dz * 0.45) === B.cactus) return true;
    }
    return false;
  }

  lookDir() {
    const cp = Math.cos(this.pitch);
    return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  }

  hurt(game, dmg, kx = 0, kz = 0, isFall = false) {
    if (this.dead || dmg <= 0 || game.creative) return;
    if (this.hurtCd > 0 && !isFall) return;
    this.hurtCd = 0.7;
    this.hp -= dmg;
    this.vx += kx * 8; this.vz += kz * 8;
    if (!isFall) this.vy = Math.max(this.vy, 4.5);
    Sfx.hurt();
    game.flashHurt();
    this.exhaustion += 0.3;
    if (this.hp <= 0) { this.hp = 0; this.die(game); }
  }
  die(game) {
    this.dead = true;
    game.onPlayerDeath();
  }
  respawn(game) {
    this.dead = false;
    this.hp = this.maxHp; this.hunger = 20; this.saturation = 5; this.air = this.maxAir;
    this.xp = 0;
    UI.refreshXp(this);
    this.x = this.spawn.x; this.z = this.spawn.z;
    this.y = game.findSpawnY(this.x, this.z);
    this.vx = this.vy = this.vz = 0;
    this.fallStart = null;
  }
}

// ---------------------------------------------------------------- input
const Input = {
  keys: {}, mouseLeft: false, mouseRight: false,
  rightClicks: [], leftClicks: [],
  uiOpen: false, locked: false,
  onLock: null,
  key(c) { return !!this.keys[c]; },
  init(canvas, game) {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      game.onKey(e.code, e);
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseLeft = this.mouseRight = false; });
    canvas.addEventListener('mousedown', e => {
      if (!this.locked) {
        // keep retrying capture on every click — some hosts grant it late
        if (game.state === 'playing' && !this.uiOpen) game.lockPointer();
        if (!game.lockFallback) return;
      }
      if (e.button === 0) { this.mouseLeft = true; this.leftClicks.push(1); }
      if (e.button === 2) { this.mouseRight = true; this.rightClicks.push(1); }
      if (e.button === 1) { e.preventDefault(); game.pickBlock(); }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouseLeft = false;
      if (e.button === 2) this.mouseRight = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.locked && game.lockFallback) { game.lockFallback = false; game.msg('Mouse captured'); }
      if (this.onLock) this.onLock(this.locked);
    });
    document.addEventListener('mousemove', e => {
      if (game.state !== 'playing' || this.uiOpen) return;
      // normal path: pointer locked. Fallback (pointer lock unavailable, e.g.
      // embedded pages): drag with any mouse button held to look around.
      if (!this.locked && !(game.lockFallback && (e.buttons & 7))) return;
      const p = game.player;
      const sens = 0.0024;
      p.yaw -= e.movementX * sens;
      p.pitch = clamp(p.pitch - e.movementY * sens, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    });
    window.addEventListener('wheel', e => {
      if (game.state !== 'playing' || this.uiOpen) return;
      game.inv.scrollHotbar(Math.sign(e.deltaY));
    }, { passive: true });
  },
};
