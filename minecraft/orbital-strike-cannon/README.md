# Orbital Strike Cannon (Minecraft Bedrock Add-On)

A Bedrock Edition add-on that adds one very dangerous item: the **Orbital Strike Cannon**.
Use it (right-click / tap-and-hold / trigger) and **500 TNT** rain down from the sky onto
whatever block you're aiming at, obliterating the area.

## What's in the box

- `BP/` — behavior pack: the custom item, a crafting recipe, and the script
  (`BP/scripts/main.js`) that spawns the barrage.
- `RP/` — resource pack: the item's pixel-art icon and display name.
- `OrbitalStrikeCannon.mcaddon` — both packs zipped up, ready to import.
- `build.py` — rebuilds the `.mcaddon` after you edit anything.
- `make_icon.py` — regenerates the item texture and pack icons.

## Install

1. Download `OrbitalStrikeCannon.mcaddon` and open it — Minecraft imports both packs.
2. In your world settings, activate **Orbital Strike Cannon [BP]** under Behavior Packs
   (the resource pack activates automatically as a dependency).
3. The world must allow cheats OR you craft the cannon; no experimental toggles are
   needed (the script uses only stable `@minecraft/server` APIs, Minecraft 1.21+).

## Getting the cannon

- Creative: search "Orbital Strike Cannon" in the inventory.
- Command: `/give @s orbital:strike_cannon`
- Survival crafting (crafting table):

  ```
  gunpowder  TNT        gunpowder
  TNT        eye ender  TNT
  gunpowder  iron block gunpowder
  ```

## How the strike works

- Aims at the block in your crosshair, up to 150 blocks away (falls back to your
  own position if you're aiming at open sky).
- Spawns 500 primed TNT ~60–80 blocks above the target, spread over a 14-block-radius
  circle, in batches of 20 per tick (~1.25 seconds) so the game doesn't hitch.
- 10-second cooldown on the item so one click = one strike.

**Fair warning:** 500 TNT will crater the landscape and can lag low-end devices.
Do not fire it near anything you love. To tone it down (or up), edit the constants
at the top of `BP/scripts/main.js` (`TNT_COUNT`, `STRIKE_RADIUS`, `DROP_HEIGHT`)
and re-run `python3 build.py`.
