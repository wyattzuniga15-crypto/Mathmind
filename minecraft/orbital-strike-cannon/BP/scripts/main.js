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

/**
 * Spawn one formation of shells and hand them to the impact sweep above. Both
 * weapons go through here, so the nuke rides the exact path the cannon has been
 * running successfully rather than anything new.
 */
function launchVolley(dimension, target, formation) {
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
}

// ============================================================================
// Tactical Nuke
// ============================================================================
// Earlier versions tried to dig the crater by clearing its blocks directly,
// which meant depending on block APIs whose shape varies between runtimes.
// Several releases went by without that ever working here, so it is gone.
//
// The nuke is now built from the only destruction this pack has ever actually
// performed on a real device: the cannon's shells, which spawn, fall and
// detonate on impact. A nuke is simply several volleys, each tighter than the
// last and timed to land in the hole the previous one made. The bowl shape
// comes out on its own — the centre is hit by every wave and ends ~28 blocks
// down, the rim by one and stays shallow.

const BUILD = "b9";
const NUKE_ID = "orbital:tactical_nuke";
const NUKE_AIM_DISTANCE = 300; // aim further than the blast reaches
const NUKE_FUSE_SECONDS = 5; // time to run

// radius, rings, shells. Shell spacing stays under ~8 blocks throughout, which
// a power-8 blast (~6.4 effective) covers with overlap to spare.
const NUKE_WAVES = [
  { radius: 60, rings: 12, shells: 300 },
  { radius: 45, rings: 10, shells: 200 },
  { radius: 32, rings: 8, shells: 120 },
  { radius: 20, rings: 6, shells: 60 }
];
const WAVE_INTERVAL = 25; // ticks between waves, so each lands in the last crater

/** One blast, using the exact call the cannon has proven on this device. */
function blast(dimension, at, radius) {
  try {
    dimension.createExplosion(at, radius, {
      breaksBlocks: true,
      causesFire: false,
      allowUnderwater: true
    });
    return true;
  } catch {
    return false;
  }
}

/** Shockwave: a ring of blasts racing outward across the ground. */
function shockwave(dimension, target) {
  let r = 4;
  const runId = system.runInterval(() => {
    const count = Math.max(8, Math.round(r / 4));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r;
      blast(
        dimension,
        { x: target.x + Math.cos(a) * r, y: target.y + 2, z: target.z + Math.sin(a) * r },
        5
      );
    }
    r += 8;
    if (r > 60) system.clearRun(runId);
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
      const spread = 3 + (stemY / TOP) * 7;
      blast(dimension, { x: target.x, y: target.y + stemY, z: target.z }, 6);
      for (let i = 0; i < 2; i++) {
        const a = (tick * 0.9 + i * Math.PI) % (Math.PI * 2);
        blast(
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
      // Cap: a ring rolling outward and up, the way the real thing curls over.
      const age = tick - Math.ceil(TOP / 3);
      const capR = 6 + age * 4;
      const count = Math.max(6, Math.round(capR / 4));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + age * 0.4;
        blast(
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
  // The fireball first — nothing may be placed ahead of the one call this
  // device is known to run. Every stage after it is wrapped on its own, so a
  // failure anywhere costs that stage and nothing else.
  const fired = blast(dimension, { x: target.x, y: target.y + 3, z: target.z }, 14);

  try {
    player.onScreenDisplay.setTitle("§4§l☢ DETONATION ☢", {
      fadeInDuration: 0,
      stayDuration: 50,
      fadeOutDuration: 20
    });
  } catch {}

  // Waves, each landing in the crater the last one dug.
  let launched = 0;
  NUKE_WAVES.forEach((wave, index) => {
    try {
      system.runTimeout(() => {
        try {
          launchVolley(
            dimension,
            target,
            buildRingFormation(wave.shells, wave.radius, wave.rings)
          );
        } catch {}
      }, index * WAVE_INTERVAL);
      launched += wave.shells;
    } catch {}
  });

  try {
    shockwave(dimension, target);
  } catch {}
  try {
    mushroomCloud(dimension, target);
  } catch {}

  try {
    world.sendMessage(
      `§4☢ §cNuke §7[${BUILD}] blast:${fired ? "ok" : "§cFAILED§7"} ` +
      `waves:${NUKE_WAVES.length} shells:${launched}`
    );
  } catch {}
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
    try {
      detonateNuke(dimension, target, player);
    } catch {}
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
      `§aOrbital arsenal loaded §7[${BUILD}] — cannon (${TNT_COUNT} shells) and tactical nuke`
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

  launchVolley(
    dimension,
    target,
    buildRingFormation(TNT_COUNT, STRIKE_RADIUS, RING_COUNT)
  );
});
