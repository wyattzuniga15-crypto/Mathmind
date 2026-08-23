import { world, system } from "@minecraft/server";

// Orbital Strike Cannon
// Using the item calls down a barrage of TNT from the sky, centered on the
// block the player is looking at (or on the player if they're aiming at air).
//
// A strike runs in three stages:
//   assemble - shells spawn into a ring formation and hover there, weightless
//   release  - gravity is switched on so the whole circle drops as one sheet
//   impact   - each shell detonates when it touches down, never on a fuse
// Spawning takes a couple of seconds, so shells cannot be given gravity as they
// appear: the first ones would be a hundred blocks down before the last ones
// existed, and the volley would fall as a corkscrew instead of a circle.

const CANNON_ID = "orbital:strike_cannon";
const SHELL_ID = "orbital:sky_tnt";
const TNT_COUNT = 2000; // total TNT per strike
const DROP_HEIGHT = 60; // how far above the target the circle assembles
const STRIKE_RADIUS = 30; // radius of the target circle
const RING_COUNT = 16; // concentric rings the volley is laid out on

// Rates. Each of these caps how much work a single tick can be asked to do,
// which is what keeps a strike from locking up a phone.
const SPAWN_PER_TICK = 50; // assembling the formation
const RELEASE_PER_TICK = 500; // switching gravity on, so ~4 ticks for 2000
const DETONATIONS_PER_TICK = 100; // explosions, the most expensive part by far
const SCAN_PER_TICK = 800; // shells checked for touchdown

const SETTLE_TICKS = 10; // a shell can't have landed before this many ticks
const MAX_FLIGHT_TICKS = 400; // failsafe: one stuck in water blows anyway

/** Shells falling, as { entity, dropTick }. */
const inFlight = [];
let cursor = 0;

function hasLanded(shell, now) {
  const onGround = shell.entity.isOnGround;
  if (typeof onGround === "boolean") return onGround;
  // Runtimes without isOnGround: a shell that has stopped falling has landed.
  if (now - shell.dropTick < SETTLE_TICKS) return false;
  return Math.abs(shell.entity.getVelocity().y) < 0.01;
}

system.runInterval(() => {
  if (inFlight.length === 0) {
    cursor = 0;
    return;
  }
  const now = system.currentTick;
  let checked = 0;
  let detonated = 0;
  while (
    checked < SCAN_PER_TICK &&
    detonated < DETONATIONS_PER_TICK &&
    inFlight.length > 0
  ) {
    if (cursor >= inFlight.length) cursor = 0;
    const shell = inFlight[cursor];
    let finished = false;
    try {
      if (hasLanded(shell, now) || now - shell.dropTick > MAX_FLIGHT_TICKS) {
        shell.entity.triggerEvent("orbital:detonate");
        detonated++;
        finished = true;
      }
    } catch {
      finished = true; // shell already gone, or its chunk unloaded
    }
    if (finished) {
      // Swap-and-pop; the shell moved into this slot is checked next pass.
      inFlight[cursor] = inFlight[inFlight.length - 1];
      inFlight.pop();
    } else {
      cursor++;
    }
    checked++;
  }
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
 * Switch gravity on across the assembled circle. Spread over a few ticks to
 * keep the spike down: four ticks of falling separates the first shell from
 * the last by under a quarter of a block, so the sheet still reads as flat.
 */
function releaseVolley(shells) {
  let released = 0;
  const runId = system.runInterval(() => {
    const now = system.currentTick;
    for (let i = 0; i < RELEASE_PER_TICK && released < shells.length; i++, released++) {
      const shell = shells[released];
      try {
        shell.triggerEvent("orbital:drop");
        inFlight.push({ entity: shell, dropTick: now });
      } catch {
        // Shell already gone.
      }
    }
    if (released >= shells.length) {
      system.clearRun(runId);
    }
  }, 1);
}

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
  const assembled = [];
  let spawned = 0;

  const runId = system.runInterval(() => {
    for (let i = 0; i < SPAWN_PER_TICK && spawned < formation.length; i++, spawned++) {
      const offset = formation[spawned];
      try {
        // Every shell at one height, weightless until the release below.
        assembled.push(
          dimension.spawnEntity(SHELL_ID, {
            x: target.x + offset.x,
            y: dropY,
            z: target.z + offset.z
          })
        );
      } catch {
        // Chunk not loaded or entity cap reached — skip this one.
      }
    }
    if (spawned >= formation.length) {
      system.clearRun(runId);
      releaseVolley(assembled);
    }
  }, 1);
});
