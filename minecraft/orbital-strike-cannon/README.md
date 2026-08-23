# Orbital Strike Cannon (Minecraft Bedrock Add-On)

A Bedrock Edition add-on that adds one very dangerous item: the **Orbital Strike
Cannon**. Use it and **500 heavy shells** fall from the sky as a flat circle
**96 blocks across** onto whatever block you're aiming at, each detonating the
moment it hits the ground with twice the blast radius of vanilla TNT.

## What's in the box

- `BP/` — behavior pack: the custom item, a crafting recipe, the fuseless shell
  entity, and the script (`BP/scripts/main.js`) that lays out the barrage and
  detonates each shell on impact.
- `RP/` — resource pack: the item's pixel-art icon, the shell's TNT texture and
  model, and display names.
- `OrbitalStrikeCannon.mcaddon` — both packs zipped up, ready to import.
- `verify.py` — cross-checks the pack for the mistakes that stop it activating.
- `build.py` — verifies, then rebuilds the `.mcaddon`.
- `make_icon.py` — regenerates the item texture, shell texture and pack icons.

## Install

1. **Delete every older copy first.** Go to **Settings → Storage**, then both the
   Behavior Packs and Resource Packs lists, and remove anything called *Orbital
   Strike Cannon* that isn't labelled **v2**. This matters — see below.
2. Open `OrbitalStrikeCannon.mcaddon`. Minecraft imports both packs.
3. In your world settings, activate **Orbital Strike Cannon v2 [BP]** under
   Behavior Packs. The resource pack comes along as a dependency.
4. Join the world. The cannon announces itself in chat:
   `Orbital Strike Cannon loaded — 500 TNT per strike`. **If that line doesn't
   appear, the add-on isn't running** and nothing else will work.

Requires Minecraft 1.21.30 or newer. No experimental toggles needed — the script
uses only stable `@minecraft/server` APIs.

## Why v2 has new IDs

Minecraft files a pack under its UUID *and* its version, so publishing a new
version installs a second copy beside the old one rather than replacing it.
Several v1.x releases stacked up that way, all sharing one UUID, and a behavior
pack whose resource-pack dependency can't be resolved cleanly **refuses to
activate at all** — tapping Activate appears to do nothing, and world creation
can fail outright.

v2 carries entirely fresh UUIDs, so it cannot collide with any v1.x install.
Its version stays at `2.0.0` from here on: re-importing at the same version
overwrites in place, so future updates won't stack up again.

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
your own position if you're aiming at open sky. Then:

1. **Formation** — 500 shells are laid out on 12 concentric rings inside a
   48-block radius. Each ring carries shells in proportion to its circumference,
   so spacing stays even (~3.9 blocks) from the bullseye to the rim, and each
   ring is twisted by a golden-ratio turn so neighbouring rings don't line up
   into spokes.
2. **Drop** — the whole volley spawns across two ticks, which separates the
   first shell from the last by 0.04 blocks. The sheet is flat on the way down
   without any need to hold the shells in the air first.
3. **Impact** (~3.7s later) — each shell detonates on touchdown at **power 8**,
   twice vanilla TNT's blast radius. Detonations run in formation order, so the
   blast rolls outward from the bullseye as a shockwave over about two seconds
   rather than popping at random.

The shells have **no fuse** and are immune to damage, so nothing airbursts on
the way down and no neighbour's blast can destroy one before it lands. The
explosion is fired from script rather than left to the shell's explode
component, so a detonation can't be quietly lost — the component is kept as a
fallback. A shell also can't count as landed for its first 20 ticks, well inside
the ~67 a real 60-block fall takes, which stops the volley airbursting if a
runtime ever reports a freshly spawned shell as already on the ground.

There's a 15-second cooldown on the item, so one use is one strike.

## Changing it

The dials are at the top of `BP/scripts/main.js`: `TNT_COUNT`, `STRIKE_RADIUS`,
`RING_COUNT`, `DROP_HEIGHT`, `EXPLOSION_RADIUS`, and `DETONATIONS_PER_TICK`.

Size and power were bought with blast radius rather than more shells, because
entity count is what costs frame rate — 500 stayed put while the strike grew to
nine times the area. Explosion cost climbs with the *cube* of `EXPLOSION_RADIUS`,
so power 8 is about eight vanilla TNT worth of work per shell; the detonation cap
came down from 100 to 12 to match, keeping per-tick cost where it was and
spending the difference on a longer, rolling blast.

If it runs badly, lower `DETONATIONS_PER_TICK` first — it stretches the wave
over more ticks without shrinking the crater at all. Raising `EXPLOSION_RADIUS`
is the most expensive change you can make; raising `STRIKE_RADIUS` alone is the
cheapest, though past about 56 blocks the 500 shells spread far enough apart
that the crater turns lumpy instead of solid.

Run `python3 build.py` after any edit. It runs `verify.py` first and refuses to
package a pack that wouldn't activate.

**Fair warning:** this now flattens a 96-block-wide circle and digs deep. Don't
fire it anywhere near anything you want to keep.
