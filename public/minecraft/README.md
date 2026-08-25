# BlockCraft

A self-contained, Minecraft-Bedrock-style voxel survival game that runs entirely in the
browser. Everything — block textures, item icons, mob skins, sounds, terrain — is
generated procedurally in code, so there are no external assets, libraries, or network
requests. It is an original work for private use, not affiliated with Mojang or Microsoft.

## Playing

- **Deployed**: visit `/minecraft/` on the site.
- **Local**: open `index.html` in any browser with WebGL2 (Chrome, Edge, Firefox), or serve
  the folder with any static server.

Two buttons: **Play Survival** and **Creative Mode**. Each keeps its own saved world,
stored automatically (every 20 seconds and on pause/quit) in your browser's localStorage,
and the matching button resumes it. You can switch mode mid-game from the pause menu.

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
| M | Toggle music |
| Esc | Pause (look sensitivity slider lives here) |
| Double-tap Space | Fly (creative) — Space up, Shift down |

On a phone or tablet the game switches to touch controls: a floating joystick to move
(push to the edge to sprint), drag anywhere to look, tap to place or attack, hold to mine,
plus jump, sneak, inventory and pause buttons.

## Beating the game

The full progression is here, the same shape as the real thing:

1. Gather wood and stone, craft tools, survive the first nights.
2. Mine **diamonds**, then build a 4x5 **obsidian** frame and light it with **flint and
   steel** (iron ingot + flint) to open a **Nether portal**.
3. In the **Nether**, find a **fortress** and kill **blazes** for blaze rods; craft
   **blaze powder**.
4. Back in the **Overworld**, hunt **endermen** at night for **ender pearls**, and combine
   them with blaze powder into **eyes of ender**.
5. **Throw an eye** to point the way to the buried **stronghold**, a few hundred blocks
   out, and fill the twelve **end portal frames** to open the way.
6. In **The End**, break the **end crystals** on the obsidian pillars — they heal the
   dragon — then bring down the **Ender Dragon**.
7. The exit portal opens, a dragon egg is left behind, and the credits roll.

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
- **Three dimensions**: the Overworld, the Nether (netherrack caverns, lava seas,
  glowstone, quartz, nether fortresses with loot) and The End (a floating island of end
  stone, obsidian pillars, end crystals and the dragon), each with its own sky and light
- **Creative mode**: flight, invulnerability, instant mining, unlimited blocks and a
  tabbed palette of every block and item in the game
- **Mobs of every dimension**: ghasts and blazes that hover and throw fire, zombie pigmen
  that turn on you when struck, endermen that blink away when hit
- TNT with chain reactions, water and lava making obsidian, XP levels, achievements
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
| `dimgen.js` | Nether and End terrain, nether fortresses, the stronghold |
| `dims.js` | Travel between dimensions, portals, eyes of ender, creative mode, credits |
| `boss.js` | End crystals and the Ender Dragon |
| `touch.js` | Touch controls for phones and tablets |
