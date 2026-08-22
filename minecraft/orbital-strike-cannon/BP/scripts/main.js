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
const STRIKE_RADIUS = 30; // horizontal spread of the barrage
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

  let spawned = 0;
  const runId = system.runInterval(() => {
    for (let i = 0; i < BATCH_PER_TICK && spawned < TNT_COUNT; i++, spawned++) {
      // Random point in a disc so the barrage lands as a filled circle.
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * STRIKE_RADIUS;
      const spawnAt = {
        x: target.x + Math.cos(angle) * radius,
        y: target.y + DROP_HEIGHT + Math.random() * 20,
        z: target.z + Math.sin(angle) * radius
      };
      try {
        const shell = dimension.spawnEntity(SHELL_ID, spawnAt);
        shell.applyImpulse({
          x: (Math.random() - 0.5) * 0.15,
          y: 0,
          z: (Math.random() - 0.5) * 0.15
        });
        inFlight.push({ entity: shell, spawnTick: system.currentTick });
      } catch {
        // Chunk not loaded or entity cap reached — skip this one.
      }
    }
    if (spawned >= TNT_COUNT) {
      system.clearRun(runId);
    }
  }, 1);
});
