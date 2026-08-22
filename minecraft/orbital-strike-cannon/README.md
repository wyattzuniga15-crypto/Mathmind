# Orbital Strike Cannon (Minecraft Bedrock Add-On)

A Bedrock Edition add-on that adds one very dangerous item: the **Orbital Strike Cannon**.
Use it (right-click / tap-and-hold / trigger) and **5000 TNT** rain down from the sky onto
whatever block you're aiming at, obliterating the area.

## What's in the box

- `BP/` — behavior pack: the custom item, a crafting recipe, the fuseless shell
  entity, and the script (`BP/scripts/main.js`) that spawns the barrage and
  detonates each shell on impact.
- `RP/` — resource pack: the item's pixel-art icon, the shell's TNT texture and
  model, and display names.
- `OrbitalStrikeCannon.mcaddon` — both packs zipped up, ready to import.
- `build.py` — rebuilds the `.mcaddon` after you edit anything.
- `make_icon.py` — regenerates the item texture and pack icons.

## Install

1. Download `OrbitalStrikeCannon.mcaddon` and open it — Minecraft imports both packs.
2. In your world settings, activate **Orbital Strike Cannon v1.2 [BP]** under Behavior
   Packs (the resource pack activates automatically as a dependency). The version is
   in the pack's name so an older install can't be mistaken for this one.
3. The world must allow cheats OR you craft the cannon; no experimental toggles are
   needed (the script uses only stable `@minecraft/server` APIs, Minecraft 1.21+).

## Updating (and getting rid of duplicates)

Minecraft files an imported pack under its UUID *and* its version number, so
raising the version in `manifest.json` installs a second copy alongside the old
one instead of replacing it — that's where a duplicate entry in the pack list
comes from. Delete the older copies under **Settings -> Storage**, on both the
Behavior Packs and Resource Packs lists: anything not labelled **v1.2** is stale.

The quickest way to tell which one a world is actually running is to fire the
cannon and read the subtitle. It prints the live shell count, so "500" means the
1.0 pack is still active.

To avoid the duplicate entirely, leave the header `version` alone when you edit
the pack. Re-importing the same UUID at the same version overwrites the
installed copy in place, and any world already using it picks up the change.

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
- Lays 5000 shells out on 16 concentric rings inside a 30-block radius. Each ring
  carries shells in proportion to its circumference, so the spacing stays even
  (~0.32 blocks) from the bullseye to the rim, and each ring is twisted by a
  golden-ratio turn so neighbouring rings don't line up into spokes.
- Spawns them centre-first at a single height, 50 per tick (~5 seconds), with no
  impulse or vertical jitter. The circle draws itself outward on the way down and
  the detonations travel with it as an expanding shockwave.
- The shells have **no fuse**: each one detonates the instant it touches the
  ground, so nothing airbursts on the way down. They are also immune to damage,
  so a neighbour's blast can't destroy one before it lands.
- 15-second cooldown on the item so one use = one strike, with time for the
  blast wave to finish before you can fire again.

**Fair warning:** 5000 TNT will crater the landscape and can lag low-end devices.
Do not fire it near anything you love. To tone it down (or up), edit the constants
at the top of `BP/scripts/main.js` (`TNT_COUNT`, `STRIKE_RADIUS`, `DROP_HEIGHT`)
and re-run `python3 build.py`.
