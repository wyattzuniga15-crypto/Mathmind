# Orbital Strike Cannon (Minecraft Bedrock Add-On)

A Bedrock Edition add-on that adds one very dangerous item: the **Orbital Strike Cannon**.
Use it (right-click / tap-and-hold / trigger) and **500 TNT** rain down from the sky onto
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
2. In your world settings, activate **Orbital Strike Cannon v1.4 [BP]** under Behavior
   Packs (the resource pack activates automatically as a dependency). The version is
   in the pack's name so an older install can't be mistaken for this one.
3. The world must allow cheats OR you craft the cannon; no experimental toggles are
   needed (the script uses only stable `@minecraft/server` APIs, Minecraft 1.21+).

## Updating (and getting rid of duplicates)

Minecraft files an imported pack under its UUID *and* its version number, so
raising the version in `manifest.json` installs a second copy alongside the old
one instead of replacing it — that's where a duplicate entry in the pack list
comes from. Delete the older copies under **Settings -> Storage**, on both the
Behavior Packs and Resource Packs lists: anything not labelled **v1.4** is stale.

The quickest way to tell which one a world is actually running is to fire the
cannon and read the subtitle. It prints the live shell count, so anything other
than 500 means an older pack is still active.

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

It aims at the block in your crosshair, up to 150 blocks away, falling back to
your own position if you're aiming at open sky. From there a strike runs in
three stages, each rate-capped so no single tick is asked to do too much:

1. **Assemble** (0.5s) — 500 shells spawn onto 10 concentric rings inside a
   16-block radius and hang there weightless. Each ring carries shells in
   proportion to its circumference, so spacing stays even (~1.1 blocks) from the
   bullseye to the rim, and each ring is twisted by a golden-ratio turn so
   neighbouring rings don't line up into spokes.
2. **Release** (0.1s) — gravity is switched on across the whole circle at once,
   so it falls as one flat sheet. Shells can't simply be given gravity as they
   spawn: assembly takes time, so the first shells would be well down before the
   last ones existed and the volley would fall as a corkscrew.
3. **Impact** (~3.4s later) — each shell detonates on touchdown, never on a
   fuse, capped at 100 explosions per tick so the craters roll outward instead
   of landing in a single frame.

The shells have **no fuse** and are immune to damage, so nothing airbursts on
the way down and no neighbour's blast can destroy one before it lands. The
explosion itself is fired from script rather than left to the shell's own
explode component, so a detonation can't be quietly lost — the component is
kept as a fallback. A shell is also barred from counting as landed for the
first 20 ticks after release, which is far less than the ~67 ticks a real
60-block fall takes, and stops the volley airbursting if a runtime ever
reports a weightless shell as already resting on the ground.

There's a 15-second cooldown on the item, so one use is one strike with time
for the blast to finish before you can fire again.

Want a wider crater? `STRIKE_RADIUS` and `RING_COUNT` are at the top of
`BP/scripts/main.js`. Widening the radius without raising `TNT_COUNT` thins the
rings out — at radius 30 the same 500 shells sit 3.2 blocks apart and the circle
reads as dotted rather than solid. Re-run `python3 build.py` after any edit.

**Fair warning:** 500 TNT still craters the landscape. Don't fire it near
anything you love.
