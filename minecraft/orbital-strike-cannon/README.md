# Orbital Arsenal (Minecraft Bedrock Add-On)

A Bedrock Edition add-on with two very dangerous items.

**Orbital Strike Cannon** — 500 heavy shells fall from the sky as a flat circle
**96 blocks across** onto whatever block you're aiming at, each detonating the
moment it hits the ground with twice the blast radius of vanilla TNT.

**Tactical Nuke** — a five-second fuse, then a crater **200 blocks across** and
30 deep, under a mushroom cloud, with a shockwave racing out across the ground.

## What's in the box

- `BP/` — behavior pack: both items, their recipes, the fuseless shell entity,
  and the script (`BP/scripts/main.js`) driving both weapons.
- `RP/` — resource pack: the pixel-art item icons, the shell's TNT texture and
  model, and display names.
- `OrbitalStrikeCannon.mcaddon` — both packs zipped up, ready to import.
- `verify.py` — cross-checks the pack for the mistakes that stop it activating.
- `build.py` — verifies, then rebuilds the `.mcaddon`.
- `make_icon.py` — regenerates the item icons, shell texture and pack icons.

## Install

1. **Delete every older copy first.** Go to **Settings → Storage**, then both the
   Behavior Packs and Resource Packs lists, and remove anything called *Orbital
   Strike Cannon* that isn't labelled **v2**. This matters — see below.
2. Open `OrbitalStrikeCannon.mcaddon`. Minecraft imports both packs.
3. In your world settings, activate **Orbital Strike Cannon v2 [BP]** under
   Behavior Packs. The resource pack comes along as a dependency.
4. Join the world. The pack announces itself in chat:
   `Orbital arsenal loaded — cannon (500 shells) and tactical nuke`. **If that
   line doesn't appear, the add-on isn't running** and nothing else will work.

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

## If it won't activate

A behavior pack that refuses to activate — the button appears to do nothing, and
world creation may fail — almost always means something in it failed to load,
not that the button is broken. Two causes have bitten this pack:

- **A script that throws while loading.** Everything at the top level of
  `main.js` runs at module load, and a throw there fails the whole module. An
  event that doesn't exist on the runtime (`world.afterEvents.playerSpawn`, in
  one release) is enough. `verify.py` now holds top-level calls to a list of
  APIs proven to work here.
- **An entity that won't parse.** A component the runtime rejects fails the
  entity, which fails the pack. Keep the shell's components boring.

Older copies still sitting in **Settings → Storage** are worth clearing even
when they aren't activated — the pack list is scanned as a whole.

`../load-test/LoadTest.mcaddon` is a diagnostic: two near-empty packs, one with
a script module and one without, sharing the cannon's engine and API versions.
Whether each activates isolates a pack-loading problem from a script-module one.

## Getting the weapons

Both appear in the creative inventory, or:

- `/give @s orbital:strike_cannon` · `/give @s orbital:tactical_nuke`
- Crafting table:

  ```
  CANNON                          NUKE
  gunpowder  TNT        gunpowder    netherite  TNT          netherite
  TNT        eye ender  TNT          TNT        nether star  TNT
  gunpowder  iron block gunpowder    netherite  TNT          netherite
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

## The nuke

Use it and a five-second countdown starts, ticking down on screen — it aims up
to 300 blocks out, further than the blast reaches, so there is somewhere to run
to. Then:

- **The crater** is 200 blocks across and 30 deep at ground zero, a bowl rising
  to ground level at the rim, clearing 25 blocks above the aim point so hills
  and trees standing in it go too.
- **A mushroom cloud** climbs out of the crater and curls over into a cap.
- **A shockwave** of blasts races outward across the ground, damaging what it
  passes.

### Why the crater isn't made of explosions

Carving this bowl with power-8 blasts would take **6,256 of them** — twelve
times the cannon's volley — and about 26 seconds at a rate a phone can stand.
Explosions are the wrong tool at this size, so the crater is dug by clearing its
blocks directly, one row at a time, which does the same 1.27 million blocks in
under six seconds. Explosions are kept for what they're good at: the fireball,
the cloud and the shockwave, none of which break blocks.

Clearing blocks is the one thing here the cannon never did, and `fillBlocks` has
changed signature between Minecraft versions. Rather than pick one and hope, the
candidates are tried the first time a nuke goes off — at runtime, inside a
handler, where a wrong guess costs one strike instead of the whole pack. If none
work it falls back to a lattice of real explosions: slower and rougher, but the
ground still goes.

Crucially the probe *verifies* rather than trusting: it aims at a block known to
be solid and only accepts a candidate that actually turns it to air. Accepting
whatever merely didn't raise an error was a real bug — an API can exist, take
these arguments, raise nothing and clear nothing, leaving a nuke that runs its
whole sequence over untouched ground.

Every blast uses `breaksBlocks: true`, the one configuration confirmed working
in game. The `false` variant shipped once and rendered nothing at all, which
took a while to spot because every call here is wrapped against load failures
and so fails silently. For that reason a detonation also prints a line saying
which clear strategy it used and whether the opening blast fired.

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

The nuke's dials are `NUKE_RADIUS`, `NUKE_DEPTH`, `NUKE_CLEAR_ABOVE`,
`NUKE_FUSE_SECONDS` and `STRIPS_PER_TICK`. That last one is the lever for
performance: it sets how many rows of crater are cleared each tick, so lowering
it stretches the dig out rather than making it heavier.

Run `python3 build.py` after any edit. It runs `verify.py` first and refuses to
package a pack that wouldn't activate.

**Fair warning:** the cannon flattens a 96-block circle; the nuke takes out 200
blocks across and 30 down, and will kill you if you're still standing in it when
the count reaches zero. Don't fire either near anything you want to keep.
