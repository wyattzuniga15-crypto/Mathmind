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

// Tells you at a glance that the pack is active and its script is running —
// if this line never appears, the add-on isn't loaded and nothing else will
// work either.
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  try {
    event.player.sendMessage(
      `§aOrbital Strike Cannon loaded §7— ${TNT_COUNT} TNT per strike`
    );
  } catch {}
});

world.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack?.typeId !== CANNON_ID) return;

  const player = event.source;
  const dimension = player.dimension;

  // Aim at the block in the player's crosshair, up to 150 blocks away.
  let target = player.location;
  try {
    const hit = player.getBlockFromViewDirection({ maxDistance: 150 });
    if (hit?.block) target = hit.block.location;
  } catch {}

  player.onScreenDisplay.setTitle("§c☄ ORBITAL STRIKE ☄", {
    subtitle: `§6Incoming: ${TNT_COUNT} TNT`,
    fadeInDuration: 5,
    stayDuration: 40,
    fadeOutDuration: 10
  });
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
