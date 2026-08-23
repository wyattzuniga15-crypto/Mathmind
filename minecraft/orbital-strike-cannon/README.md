# Orbital Arsenal (Minecraft Bedrock Add-On)

A Bedrock Edition add-on with three very dangerous items.

**Orbital Strike Cannon** — 500 heavy shells fall from the sky as a flat circle
**96 blocks across** onto whatever block you're aiming at, each detonating the
moment it hits the ground with twice the blast radius of vanilla TNT.

**Tactical Nuke** — a five-second fuse, then four waves of shells carve a crater
**120 blocks across** and 28 deep, under a mushroom cloud, with a shockwave
racing out across the ground.

**Kamehameha** — charge it through KA-ME-HA-ME-HAAA, then a beam of ki punches
**160 blocks** straight ahead, boring a 12-block-wide tunnel through anything in
the way. Aim it at a mountain and you get a hole out the other side.

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

- `/give @s orbital:strike_cannon` · `/give @s orbital:tactical_nuke` ·
  `/give @s orbital:kamehameha`
- Crafting table:

  ```
  CANNON                            NUKE                          KAMEHAMEHA
  gunpowder  TNT        gunpowder   netherite  TNT      netherite  glowstone  diamond   glowstone
  TNT        eye ender  TNT         TNT     nether star  TNT       diamond  heart of sea diamond
  gunpowder  iron block gunpowder   netherite  TNT      netherite  glowstone  diamond   glowstone
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
to. Then a fireball, a mushroom cloud, a shockwave racing outward, and **four
waves of shells** falling on the target.

Each wave is tighter than the last and timed to land in the hole the previous
one dug, so the crater deepens as the barrage goes on. The bowl shape comes out
on its own: the centre is hit by every wave and ends about 28 blocks down, while
the rim takes one wave and stays shallow. About 120 blocks across, 680 shells,
roughly eight seconds from the count reaching zero.

| wave | radius | shells | spacing | depth at centre |
|------|--------|--------|---------|-----------------|
| 1 | 60 | 300 | 8.2 blocks | ~7 |
| 2 | 45 | 200 | 7.8 blocks | ~14 |
| 3 | 32 | 120 | 7.5 blocks | ~21 |
| 4 | 20 | 60  | 7.3 blocks | ~28 |

### Why it's built this way

Earlier versions dug the crater by clearing its blocks directly — far cheaper on
paper, and it would have allowed 200 blocks across. In practice it never worked
on a real device. `fillBlocks` changes signature between runtimes, wants a
string on some and a `BlockPermutation` on others, and an API that exists and
raises nothing can still change nothing. Several releases went by chasing it.

So the nuke was rebuilt on the only destruction this pack has ever actually
performed in game: the cannon's shells. Both weapons now go through the same
`launchVolley`, and the nuke is simply several volleys with a delay between
them. Nothing in its path is unproven, and about 200 lines of fragile
capability-probing went in the bin.

The trade is size — 120 blocks across instead of 200, since explosions cost far
more per block cleared than a bulk fill would. A working 120 beats a
theoretical 200.

## The kamehameha

Use it and the charge runs KA — ME — HA — ME — HAAA, half a second a syllable,
with a ball of ki swelling at your hands. Aim is read at the moment of firing,
not when you started, so you can track a target while charging. Then the beam
goes out 160 blocks in one second, boring a tunnel about 12 blocks wide through
whatever stands in the way, and detonates where it ends.

The tunnel is cut by explosions spaced along the beam line — four per tick, two
blocks apart, each with a radius of six, so they overlap and leave no standing
rock between them. The whole beam costs about a seventh of the cannon's
per-tick budget: boring a tunnel is far cheaper than digging a crater, because
it only clears what it passes through.

The visible shaft is a string of small ki entities placed a block apart along
the beam. They carry no gravity, so the shaft stays dead straight rather than
sagging, and the script removes them on a timer instead of the entity managing
its own lifetime — keeping the entity itself as plain as the shell that has run
since the beginning.

Dials: `KAME_RANGE`, `KAME_SPEED`, `KAME_BORE` (tunnel radius), `KAME_BORE_STEPS`
(blasts per tick — lower it and the beam starts outrunning its own bore, leaving
terrain standing) and `KI_SPACING` / `KI_LIFETIME` for how solid the shaft looks.

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

The nuke is shaped by `NUKE_WAVES` — a radius, ring count and shell count per
wave — plus `WAVE_INTERVAL` and `NUKE_FUSE_SECONDS`. Add a wave to dig deeper;
widen wave 1 to spread wider, but raise its shell count with it or the spacing
opens past what a blast covers and the crater turns lumpy. `DETONATIONS_PER_TICK`
is shared with the cannon and is the lever for frame rate.

Run `python3 build.py` after any edit. It runs `verify.py` first and refuses to
package a pack that wouldn't activate.

**Fair warning:** the cannon flattens a 96-block circle; the nuke takes out 200
blocks across and 30 down, and will kill you if you're still standing in it when
the count reaches zero. Don't fire either near anything you want to keep.
