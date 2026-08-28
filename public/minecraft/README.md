# BlockCraft

A self-contained, Minecraft-Bedrock-style voxel survival game that runs entirely in the
browser. Everything — block textures, item icons, mob skins, sounds, terrain — is
generated procedurally in code, so there are no external assets, libraries, or network
requests. It is an original work for private use, not affiliated with Mojang or Microsoft.

## Playing

- **Deployed**: visit `/minecraft/` on the site.
- **Local**: open `index.html` in any browser with WebGL2 (Chrome, Edge, Firefox), or serve
  the folder with any static server.
- **Single file**: run `node build-single.mjs` to bundle every script into one standalone
  `BlockCraft.html`. Save it anywhere and double-click it — no server, no install.

Play from a real browser tab (the local file or the deployed page) rather than an embedded
preview: pointer lock, and therefore proper mouse capture, is blocked inside sandboxed
iframes. Click the canvas to capture the mouse; **Esc** releases it and opens the pause
menu, where the look-sensitivity slider lives.

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
  biomes, caves, lakes, frozen oceans and lava pools
- Ore in scarce veins rather than scattered singles: a chunk holds roughly twenty coal,
  eleven iron, and a five-block pocket of gold or diamond only every fourth chunk. Veins
  are seeded per chunk, spill across chunk borders from a deterministic stream, and only
  ever replace stone, so nothing floats in a cave
- Day/night cycle with sun, moon, stars, drifting clouds, and dawn/dusk skies
- Survival systems on the real numbers: health and hunger drawn as pixel-art hearts and
  drumsticks that wobble when you are low, and the actual exhaustion model behind them —
  0.1 per metre sprinted, 0.01 swimming, 0.05 a jump, 0.005 a block broken, 0.1 a hit
  taken, 6.0 per point healed, spending saturation before the visible bar. Walking is
  free; healing is what really costs you. Plus fall damage, drowning with air bubbles,
  lava and cactus damage, starvation, death and respawn
- Full inventory with drag/split/stack, 2×2 and 3×3 crafting, tool tiers (wood, stone,
  iron, gold, diamond) with durability, furnace smelting with fuel, chests with persistent
  storage
- **Sixty-seven creatures**, spawned from weighted per-dimension tables that care about
  biome, depth, light and whether the spot is ground, cave, open air or deep water:
  - *Farmyard and wild*: cows, pigs, sheep, chickens, rabbits, foxes, wolves, goats,
    horses, llamas, camels, pandas, polar bears, turtles, frogs, sniffers, mooshrooms,
    armadillos that roll into a ball when you come near
  - *Water*: cod, salmon, squid, glow squid, dolphins, axolotls, and guardians that hold
    position and burn you with a beam — anything aquatic suffocates if you land it
  - *Air*: bats, bees, parrots, allays that tag along at your shoulder, phantoms and vexes
    that swoop, and the happy ghast
  - *Village*: villagers, iron golems and snow golems that pick fights with whatever is
    hunting you, and copper golems
  - *Night and the dark*: zombies, husks, drowned, zombie villagers, skeletons, strays,
    bogged, creepers, spiders, cave spiders, silverfish, endermen, endermites, witches
    lobbing splash potions, slimes that split when you kill them, breezes firing wind
    charges that launch you, creakings that only move when you are not looking at them,
    pillagers, vindicators, evokers that summon vexes, ravagers that charge, and the
    warden with its sonic shriek
  - *The Nether*: ghasts, blazes, zombie pigmen, piglin brutes, wither skeletons, hoglins,
    magma cubes and striders that walk on lava
  - *The End*: endermen, endermites and shulkers
  The undead still burn at sunrise
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
- Hand-authored pixel-art textures generated in code: coherent mottling rather than
  static, voronoi cobblestone lit from the top left, ore pockets with dark rims, a
  ragged grass overhang, plank boards with staggered joints and knots, growth rings on
  log ends, and grass blades that bend at the tip

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
| `build-single.mjs` | Bundles everything into one standalone downloadable HTML file |
