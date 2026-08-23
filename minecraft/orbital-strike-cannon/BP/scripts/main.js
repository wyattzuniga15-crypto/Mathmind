import { world, system } from "@minecraft/server";

// Orbital Strike Cannon
// Using the item calls down a barrage of TNT from the sky, centered on the
// block the player is looking at (or on the player if they're aiming at air).
// The shells carry no fuse: each detonates on impact, so the volley reaches the
// ground instead of airbursting. They spawn fast enough that the formation
// falls as one flat sheet without any hovering or gravity tricks.

const CANNON_ID = "orbital:strike_cannon";
const SHELL_ID = "orbital:sky_tnt";
const TNT_COUNT = 500; // total TNT per strike
const DROP_HEIGHT = 70; // how far above the target the volley spawns
const STRIKE_RADIUS = 48; // radius of the target circle
const RING_COUNT = 12; // concentric rings the volley is laid out on

// Rates. Each caps how much work a single tick can be asked to do, which is
// what keeps a strike from locking up a phone. The whole volley spawns in two
// ticks, which separates the first shell from the last by 0.04 blocks — the
// sheet is flat without needing to hold the shells in the air first.
const SPAWN_PER_TICK = 250;
// Explosions are the expensive part, and their cost climbs with the cube of the
// radius, so a power-8 blast is roughly eight vanilla TNT worth of work. The cap
// is set to keep the per-tick cost at parity with the old power-4 volley, which
// stretches the barrage into a ~2s wave rather than making it heavier.
const DETONATIONS_PER_TICK = 12;

const EXPLOSION_RADIUS = 8; // twice vanilla TNT's blast radius
// A shell needs ~67 ticks to fall 60 blocks, so nothing can genuinely have
// landed inside this window. Holding the check off protects against a runtime
// reporting a freshly spawned shell as already resting on the ground, which
// would airburst the whole volley.
const MIN_FLIGHT_TICKS = 20;
const MAX_FLIGHT_TICKS = 400; // failsafe: one stuck in water blows anyway

/** Shells falling, in formation order: centre first, rim last. */
const inFlight = [];

function hasLanded(shell, now) {
  if (now - shell.spawnTick < MIN_FLIGHT_TICKS) return false;
  const onGround = shell.entity.isOnGround;
  if (typeof onGround === "boolean") return onGround;
  // Runtimes without isOnGround: a shell that has stopped falling has landed.
  return Math.abs(shell.entity.getVelocity().y) < 0.01;
}

/**
 * Blow one shell up. The explosion is driven from script rather than left to
 * the shell's own explode component, so a detonation can't be quietly lost to
 * a component quirk; the component stays as a fallback if the call fails.
 */
function detonate(entity) {
  const where = entity.location;
  const dimension = entity.dimension;
  let exploded = false;
  try {
    dimension.createExplosion(where, EXPLOSION_RADIUS, {
      breaksBlocks: true,
      causesFire: false,
      allowUnderwater: true
    });
    exploded = true;
  } catch {
    // Fall through to the component below.
  }
  try {
    if (exploded) entity.remove();
    else entity.triggerEvent("orbital:detonate");
  } catch {
    // Shell already gone; nothing left to clean up.
  }
}

system.runInterval(() => {
  if (inFlight.length === 0) return;
  const now = system.currentTick;
  let detonated = 0;
  let write = 0;
  // Walk in formation order and blow up the first shells that have landed, so
  // the blast travels outward as a shockwave instead of popping at random.
  // Survivors are compacted back down the array, preserving that order.
  for (let read = 0; read < inFlight.length; read++) {
    const shell = inFlight[read];
    let finished = false;
    if (detonated < DETONATIONS_PER_TICK) {
      try {
        if (hasLanded(shell, now) || now - shell.spawnTick > MAX_FLIGHT_TICKS) {
          detonate(shell.entity);
          detonated++;
          finished = true;
        }
      } catch {
        finished = true; // shell already gone, or its chunk unloaded
      }
    }
    if (!finished) inFlight[write++] = shell;
  }
  inFlight.length = write;
}, 1);

/**
 * Lay the volley out on concentric rings so the barrage falls as a circle
 * instead of a random scatter. Each ring gets shells in proportion to its
 * circumference, which keeps the spacing between neighbours even from the
 * bullseye out to the rim.
 */
function buildRingFormation(count, radius, ringCount) {
  const radii = [];
  let totalWeight = 0;
  for (let ring = 1; ring <= ringCount; ring++) {
    const r = (ring / ringCount) * radius;
    radii.push(r);
    totalWeight += r;
  }

  const offsets = [{ x: 0, z: 0 }]; // ground zero
  const outer = count - 1;
  let assigned = 0;
  let cumulative = 0;
  for (let i = 0; i < radii.length; i++) {
    const r = radii[i];
    cumulative += r;
    // Round on the running total so the rings sum to exactly `outer`.
    const target = Math.round((outer * cumulative) / totalWeight);
    const share = target - assigned;
    assigned = target;
    // Twist each ring by a golden-ratio turn, or the shells in adjacent rings
    // line up and the circle reads as spokes.
    const twist = i * 0.6180339887 * Math.PI * 2;
    for (let s = 0; s < share; s++) {
      const angle = twist + (s / share) * Math.PI * 2;
      offsets.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r });
    }
  }
  return offsets;
}

// ============================================================================
// Tactical Nuke
// ============================================================================
// A 200-block-wide crater is far too much ground for explosions: carving this
// bowl with power-8 blasts would take 6,256 of them and about 26 seconds, where
// clearing the blocks directly does it in under four. So the crater is dug by
// emptying it, and explosions are kept for what they're actually good at —
// the fireball, the mushroom cloud and the shockwave.

const NUKE_ID = "orbital:tactical_nuke";
const NUKE_RADIUS = 100; // 200 blocks across
const NUKE_DEPTH = 30; // how deep the bowl goes at ground zero
const NUKE_CLEAR_ABOVE = 25; // hills and trees standing in the blast go too
const NUKE_AIM_DISTANCE = 300; // aim further than the blast reaches
const NUKE_FUSE_SECONDS = 5; // time to run
const STRIPS_PER_TICK = 80; // crater rows cleared per tick (~5.7s total)

/**
 * Clear one row of blocks. This is the only thing the add-on does that the
 * cannon never did, and `fillBlocks` has changed signature between runtimes,
 * so rather than pick one and hope, the candidates are tried the first time a
 * nuke goes off. Probing at runtime inside a handler means a wrong guess costs
 * one strike; probing at load time would cost the whole pack.
 */
let clearRow = null;

function resolveClearRow(dimension, probe) {
  const candidates = [
    (dim, a, b) => dim.fillBlocks({ from: a, to: b }, "minecraft:air"),
    (dim, a, b) => dim.fillBlocks(a, b, "minecraft:air"),
    (dim, a, b) =>
      dim.runCommand(`fill ${a.x} ${a.y} ${a.z} ${b.x} ${b.y} ${b.z} air`)
  ];
  for (const candidate of candidates) {
    try {
      candidate(dimension, probe, probe);
      return candidate;
    } catch {
      // Not this one.
    }
  }
  return null; // nothing available — the caller falls back to explosions
}

/** A cosmetic blast: all flash and noise, no block damage. */
function puff(dimension, at, radius) {
  try {
    dimension.createExplosion(at, radius, {
      breaksBlocks: false,
      causesFire: false,
      allowUnderwater: true
    });
  } catch {}
}

/** How wide the crater is at `dy` blocks above (positive) or below the aim. */
function craterRadiusAt(dy) {
  if (dy >= 0) return dy <= NUKE_CLEAR_ABOVE ? NUKE_RADIUS : 0;
  const below = -dy;
  if (below > NUKE_DEPTH) return 0;
  // Bowl: full depth at the centre, rising to aim level at the rim.
  return NUKE_RADIUS * Math.sqrt(1 - below / NUKE_DEPTH);
}

/**
 * Empty the crater a row at a time, top down, so the ground appears to be
 * eaten away from above. Walking a cursor across levels rather than building
 * the whole list up front keeps this to a few numbers of state.
 */
function carveCrater(dimension, target, clear) {
  const cx = Math.floor(target.x);
  const cy = Math.floor(target.y);
  const cz = Math.floor(target.z);
  let dy = NUKE_CLEAR_ABOVE;
  let x = null;
  let xMax = 0;

  const runId = system.runInterval(() => {
    let done = 0;
    while (done < STRIPS_PER_TICK) {
      if (dy < -NUKE_DEPTH) {
        system.clearRun(runId);
        return;
      }
      const r = craterRadiusAt(dy);
      if (r <= 0) {
        dy--;
        x = null;
        continue;
      }
      if (x === null) {
        xMax = Math.floor(r);
        x = -xMax;
      }
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - x * x)));
      const y = cy + dy;
      try {
        clear(
          dimension,
          { x: cx + x, y, z: cz - half },
          { x: cx + x, y, z: cz + half }
        );
      } catch {
        // Chunk not loaded, or outside the world's height — skip this row.
      }
      done++;
      if (++x > xMax) {
        dy--;
        x = null;
      }
    }
  }, 1);
}

/** Coarse lattice of real explosions, for runtimes with no working fill. */
function carveByExplosion(dimension, target) {
  const STEP = 8;
  const points = [];
  for (let dy = NUKE_CLEAR_ABOVE; dy >= -NUKE_DEPTH; dy -= STEP) {
    const r = craterRadiusAt(dy);
    if (r <= 0) continue;
    for (let ring = 0; ring * STEP <= r; ring++) {
      const rr = ring * STEP;
      const count = Math.max(1, Math.round((2 * Math.PI * rr) / STEP));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + ring;
        points.push({
          x: target.x + Math.cos(a) * rr,
          y: target.y + dy,
          z: target.z + Math.sin(a) * rr
        });
      }
    }
  }
  let at = 0;
  const runId = system.runInterval(() => {
    for (let i = 0; i < 12 && at < points.length; i++, at++) {
      try {
        dimension.createExplosion(points[at], 8, {
          breaksBlocks: true,
          causesFire: false,
          allowUnderwater: true
        });
      } catch {}
    }
    if (at >= points.length) system.clearRun(runId);
  }, 1);
}

/** Shockwave: a ring of blasts racing outward across the ground. */
function shockwave(dimension, target) {
  let r = 4;
  const runId = system.runInterval(() => {
    const count = Math.max(8, Math.round(r / 4));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r;
      puff(
        dimension,
        { x: target.x + Math.cos(a) * r, y: target.y + 2, z: target.z + Math.sin(a) * r },
        5
      );
    }
    r += 8;
    if (r > NUKE_RADIUS) system.clearRun(runId);
  }, 1);
}

/** Stem climbing out of the crater, then a cap spreading off the top. */
function mushroomCloud(dimension, target) {
  let tick = 0;
  const TOP = 90;
  const runId = system.runInterval(() => {
    tick++;
    const stemY = tick * 3;
    if (stemY <= TOP) {
      // The stem widens as it climbs.
      const spread = 3 + (stemY / TOP) * 7;
      puff(dimension, { x: target.x, y: target.y + stemY, z: target.z }, 6);
      for (let i = 0; i < 2; i++) {
        const a = (tick * 0.9 + i * Math.PI) % (Math.PI * 2);
        puff(
          dimension,
          {
            x: target.x + Math.cos(a) * spread,
            y: target.y + stemY,
            z: target.z + Math.sin(a) * spread
          },
          4
        );
      }
    } else {
      // Cap: a ring rolling outward and slightly up, the way the real thing
      // curls over on itself.
      const age = tick - Math.ceil(TOP / 3);
      const capR = 6 + age * 4;
      const count = Math.max(6, Math.round(capR / 4));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + age * 0.4;
        puff(
          dimension,
          {
            x: target.x + Math.cos(a) * capR,
            y: target.y + TOP + Math.min(14, age * 1.2),
            z: target.z + Math.sin(a) * capR
          },
          5
        );
      }
      if (capR > 46) system.clearRun(runId);
    }
  }, 1);
}

function detonateNuke(dimension, target, player) {
  try {
    player.onScreenDisplay.setTitle("§4§l☢ DETONATION ☢", {
      fadeInDuration: 0,
      stayDuration: 50,
      fadeOutDuration: 20
    });
  } catch {}
  try {
    world.sendMessage("§4☢ §cTactical nuke detonated.");
  } catch {}

  // Opening fireball, right on the deck.
  puff(dimension, { x: target.x, y: target.y + 3, z: target.z }, 14);

  if (clearRow === null) {
    clearRow = resolveClearRow(dimension, {
      x: Math.floor(target.x),
      y: Math.floor(target.y),
      z: Math.floor(target.z)
    });
  }
  if (clearRow) {
    carveCrater(dimension, target, clearRow);
  } else {
    // No usable fill on this runtime — dig it the slow, expensive way rather
    // than leave the ground untouched.
    carveByExplosion(dimension, target);
  }
  shockwave(dimension, target);
  mushroomCloud(dimension, target);
}

function armNuke(player, dimension) {
  let target = player.location;
  try {
    const hit = player.getBlockFromViewDirection({ maxDistance: NUKE_AIM_DISTANCE });
    if (hit?.block) target = hit.block.location;
  } catch {}

  let left = NUKE_FUSE_SECONDS;
  const announce = () => {
    try {
      player.onScreenDisplay.setTitle("§e§l☢ NUKE ARMED ☢", {
        subtitle: `§cDetonation in ${left}`,
        fadeInDuration: 0,
        stayDuration: 25,
        fadeOutDuration: 5
      });
    } catch {}
    try {
      player.playSound("note.pling");
    } catch {}
  };
  announce();

  const runId = system.runInterval(() => {
    left--;
    if (left > 0) {
      announce();
      return;
    }
    system.clearRun(runId);
    detonateNuke(dimension, target, player);
  }, 20);
}

// Tells you at a glance that the pack is active and its script is running —
// if this line never appears, the add-on isn't loaded and nothing else will
// work either.
//
// Anything at the top level of this file runs while the module is loading, and
// a throw there fails the whole script module, which stops the pack activating
// and can abort world creation. So this greeting sticks to world.sendMessage on
// a timer, both long-standing APIs, rather than subscribing to a newer event
// that may not exist on every runtime — and it is wrapped either way.
system.runTimeout(() => {
  try {
    world.sendMessage(
      `§aOrbital arsenal loaded §7— cannon (${TNT_COUNT} shells) and tactical nuke`
    );
  } catch {}
}, 100);

world.afterEvents.itemUse.subscribe((event) => {
  const used = event.itemStack?.typeId;
  if (used !== CANNON_ID && used !== NUKE_ID) return;

  const player = event.source;
  const dimension = player.dimension;

  if (used === NUKE_ID) {
    armNuke(player, dimension);
    return;
  }

  // Aim at the block in the player's crosshair, up to 150 blocks away.
  let target = player.location;
  try {
    const hit = player.getBlockFromViewDirection({ maxDistance: 150 });
    if (hit?.block) target = hit.block.location;
  } catch {}

  try {
    player.onScreenDisplay.setTitle("§c☄ ORBITAL STRIKE ☄", {
      subtitle: `§6Incoming: ${TNT_COUNT} TNT`,
      fadeInDuration: 5,
      stayDuration: 40,
      fadeOutDuration: 10
    });
  } catch {}
  try {
    player.playSound("mob.wither.spawn");
  } catch {}

  const formation = buildRingFormation(TNT_COUNT, STRIKE_RADIUS, RING_COUNT);
  const dropY = target.y + DROP_HEIGHT;
  let spawned = 0;

  const runId = system.runInterval(() => {
    const now = system.currentTick;
    for (let i = 0; i < SPAWN_PER_TICK && spawned < formation.length; i++, spawned++) {
      const offset = formation[spawned];
      try {
        const shell = dimension.spawnEntity(SHELL_ID, {
          x: target.x + offset.x,
          y: dropY,
          z: target.z + offset.z
        });
        inFlight.push({ entity: shell, spawnTick: now });
      } catch {
        // Chunk not loaded or entity cap reached — skip this one.
      }
    }
    if (spawned >= formation.length) {
      system.clearRun(runId);
    }
  }, 1);
});
