# BlockCraft

A self-contained, Minecraft-Bedrock-style voxel survival game that runs entirely in the
browser. Everything — block textures, item icons, mob skins, sounds, terrain — is
generated procedurally in code, so there are no external assets, libraries, or network
requests. It is an original work for private use, not affiliated with Mojang or Microsoft.

## Playing

- **Deployed**: visit `/minecraft/` on the site.
- **Local**: open `index.html` in any browser with WebGL2 (Chrome, Edge, Firefox), or serve
  the folder with any static server.

There is a single **Play Survival** button. Your world is saved automatically (every 20
seconds and on pause/quit) to your browser's localStorage, and the button resumes it.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Space | Jump / swim up |
| Ctrl (hold, moving forward) | Sprint |
| Shift | Sneak (won't fall off edges) |
| Left click (hold) | Mine blocks / attack |
| Right click | Place block, interact (crafting table, furnace, chest, bed), eat food |
| Right click (hold) | Draw bow (release to shoot) |
| E | Inventory + 2×2 crafting |
| 1–9 / mouse wheel | Select hotbar slot |
| Q | Drop held item |
| Middle click | Pick targeted block from inventory |
| F3 | Debug overlay |
| Esc | Pause |

## Features

- Infinite procedurally generated terrain with plains, forest, desert, snow, and mountain
  biomes, caves, ore veins (coal, iron, gold, diamond), lakes, frozen oceans, lava pools
- Day/night cycle with sun, moon, stars, drifting clouds, and dawn/dusk skies
- Survival systems: health, hunger, saturation, sprint/exhaustion, fall damage, drowning,
  lava and cactus damage, regeneration, death and respawn
- Full inventory with drag/split/stack, 2×2 and 3×3 crafting, tool tiers (wood, stone,
  iron, gold, diamond) with durability, furnace smelting with fuel, chests with persistent
  storage
- Mobs: cows, pigs, sheep, chickens; zombies, skeletons (with bows), creepers (they
  explode), and spiders at night — the undead burn at sunrise
- Bow and arrows, XP orbs and levels, item drops with magnet pickup, block particles,
  breaking cracks, first-person hand, torch point-lighting, ambient occlusion
- Beds set your respawn point and skip the night; saplings regrow trees; sand and gravel
  fall; wheat can be planted from seeds
- All audio synthesized live with WebAudio

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell, HUD and menu DOM, styles |
| `util.js` | Math, seeded RNG, value noise, matrices, frustum |
| `blocks.js` | Block/item registry, recipes, smelting, mining rules |
| `atlas.js` | Procedural texture atlas + item icon rendering |
| `world.js` | Chunks, terrain generation, meshing with AO, raycast, collision |
| `render.js` | WebGL2 renderer: chunk/entity/sky/cloud/outline passes |
| `entities.js` | Physics base, drops, XP orbs, arrows, mobs + AI, particles |
| `player.js` | Player movement, mining/placing, hunger, input |
| `ui.js` | Sounds, inventory model, crafting logic, DOM UI, HUD |
| `main.js` | Game state machine, streaming, day/night, spawning, saving |
