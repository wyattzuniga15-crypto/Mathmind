import { world, system } from "@minecraft/server";

// Orbital Strike Cannon
// Using the item calls down a barrage of TNT from the sky, centered on the
// block the player is looking at (or on the player if they're aiming at air).
// The shells carry no fuse — each one detonates on impact, so the whole volley
// reaches the ground instead of airbursting on the way down.

const CANNON_ID = "orbital:strike_cannon";
const SHELL_ID = "orbital:sky_tnt";
const TNT_COUNT = 5000; // total TNT per strike
const DROP_HEIGHT = 60; // how far above the target the TNT spawns
const STRIKE_RADIUS = 30; // radius of the target circle
const RING_COUNT = 16; // concentric rings the volley is laid out on
const BATCH_PER_TICK = 50; // TNT spawned per tick, so 5000 arrive over ~5s

// Impact detection. Shells in flight are checked on a rotating sweep so a full
// volley costs a bounded amount of work per tick.
const SCAN_PER_TICK = 1200;
const SETTLE_TICKS = 10; // a shell can't have landed before this many ticks
const MAX_FLIGHT_TICKS = 400; // failsafe: one stuck in water blows anyway

/** Shells still falling, as { entity, spawnTick }. */
const inFlight = [];
let cursor = 0;

function hasLanded(shell, now) {
  const onGround = shell.entity.isOnGround;
  if (typeof onGround === "boolean") return onGround;
  // Runtimes without isOnGround: a shell that has stopped falling has landed.
  if (now - shell.spawnTick < SETTLE_TICKS) return false;
  return Math.abs(shell.entity.getVelocity().y) < 0.01;
}

system.runInterval(() => {
  if (inFlight.length === 0) {
    cursor = 0;
    return;
  }
  const now = system.currentTick;
  let checked = 0;
  while (checked < SCAN_PER_TICK && inFlight.length > 0) {
    if (cursor >= inFlight.length) cursor = 0;
    const shell = inFlight[cursor];
    let finished = false;
    try {
      if (hasLanded(shell, now) || now - shell.spawnTick > MAX_FLIGHT_TICKS) {
        shell.entity.triggerEvent("orbital:detonate");
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
 * bullseye out to the rim. Returned centre-first, so spawning in order draws
 * the circle outward and the blast expands as a shockwave.
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
    for (let i = 0; i < BATCH_PER_TICK && spawned < formation.length; i++, spawned++) {
      const offset = formation[spawned];
      try {
        // Spawned at a single height and left alone — no impulse, no vertical
        // jitter — so the rings stay intact all the way down.
        const shell = dimension.spawnEntity(SHELL_ID, {
          x: target.x + offset.x,
          y: dropY,
          z: target.z + offset.z
        });
        inFlight.push({ entity: shell, spawnTick: system.currentTick });
      } catch {
        // Chunk not loaded or entity cap reached — skip this one.
      }
    }
    if (spawned >= formation.length) {
      system.clearRun(runId);
    }
  }, 1);
});
