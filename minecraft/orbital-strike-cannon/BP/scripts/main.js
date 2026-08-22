import { world, system } from "@minecraft/server";

// Orbital Strike Cannon
// Using the item calls down a barrage of TNT from the sky, centered on the
// block the player is looking at (or on the player if they're aiming at air).

const CANNON_ID = "orbital:strike_cannon";
const TNT_COUNT = 5000; // total TNT per strike
const DROP_HEIGHT = 60; // how far above the target the TNT spawns
const STRIKE_RADIUS = 30; // horizontal spread of the barrage
const BATCH_PER_TICK = 50; // TNT spawned per tick, so 5000 arrive over ~5s

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
        const tnt = dimension.spawnEntity("minecraft:tnt", spawnAt);
        tnt.applyImpulse({
          x: (Math.random() - 0.5) * 0.15,
          y: 0,
          z: (Math.random() - 0.5) * 0.15
        });
      } catch {
        // Chunk not loaded or entity cap reached — skip this one.
      }
    }
    if (spawned >= TNT_COUNT) {
      system.clearRun(runId);
    }
  }, 1);
});
