# Orbital Arsenal — Fabric mod source

Fourteen genuinely registered items — `orbital:strike_cannon`,
`orbital:tactical_nuke`, `orbital:kamehameha`, `orbital:black_hole`,
`orbital:orbital_laser`, `orbital:rewind_clock`,
`orbital:potato_bomb`,
`orbital:time_stop_clock`, `orbital:slow_time_clock`,
`orbital:echo_ghost`, `orbital:echo_beacon`,
`orbital:fast_forward_clock`, `orbital:ore_sense`, `orbital:bottled_chunk` — with their own textures,
names, creative tab entries and crafting recipes.

**You have to build this yourself.** I couldn't: this project needs Minecraft,
Yarn mappings and the Fabric loader downloaded from Mojang's and Fabric's maven
repositories, and both are blocked by egress policy on the machine I work from
(`maven.fabricmc.net` and `libraries.minecraft.net` both answer 403 to CONNECT).
There was nothing to compile against, so the jar has to be made on your machine.

## Build it

You need **JDK 21** (Minecraft 1.21 runs on 21; a newer JDK is fine too).

```
cd fabric-mod
./gradlew build          # Windows: gradlew.bat build
```

The jar lands in `build/libs/orbital-arsenal-1.0.0.jar`. Put that in your `mods`
folder alongside **Fabric API**, which this depends on.

### Check these four numbers first

Open `gradle.properties`. The top four lines pin the Minecraft version and its
matching Fabric versions:

```properties
minecraft_version=1.21.11
yarn_mappings=1.21.11+build.1
loader_version=0.17.2
fabric_version=0.135.0+1.21.11
```

**The last three are my best guess and are very likely wrong.** Go to
<https://fabricmc.net/develop/>, pick 1.21.11, and copy the exact values it
shows. If the build fails while resolving dependencies, this is the reason and
the only file you need to touch.

## What I could and couldn't verify

**Verified:** the Java compiles. I wrote stub classes for every Minecraft and
Fabric API this mod touches (in `stubs/`) and compiled the whole source against
them — 8 source files, clean. So the syntax is valid, the types line up, and
the structure is sound.

**Not verified:** that those stubs match the real 1.21.11 API. That's the part
I had no way to check, and 1.21.11 is past what I know well. If the build
fails, it will almost certainly be one of these calls, all of which have moved
in recent versions:

| call | note |
|------|------|
| `Item.Settings().registryKey(key)` | Required from 1.21.2. Older versions don't have it. |
| `use(...)` returning `ActionResult` | Was `TypedActionResult<ItemStack>` before 1.21.2. |
| `getItemCooldownManager().set(stack, ticks)` | Took an `Item` rather than an `ItemStack` before 1.21.2. |
| `world.createExplosion(..., ExplosionSourceType.TNT)` | Signature has changed more than once. |
| `SoundEvents.*` | Some entries are `RegistryEntry<SoundEvent>` needing `.value()`, some aren't. I stuck to ones I believe are plain `SoundEvent`. |
| `Identifier.of(ns, path)` | Replaced the `new Identifier(...)` constructor in 1.21. |

`stubs/` is a useful map when fixing any of these: it lists exactly what this
mod expects from each class, and nothing more.

## What the weapons do

**Orbital Strike Cannon** — 5000 TNT dropped in a ring formation **200 blocks
across** from 55 blocks up, spawned 200 per tick.

**Each shell detonates when it lands, not on a timer.** A timed fuse cannot
work at this size: the ring is 200 blocks wide, so its edges hang over whatever
terrain happens to be there. A shell falling into a ravine or over open ocean
drops several times as far as one landing at the aim point, and there is no
single fuse length that suits both — one of them always airbursts. So the
shells are given a fuse long enough that none of them ever reaches it, and a
watcher fires each one the tick it touches down. Anything still airborne after
30 seconds — dropped over the void, or orphaned by an unloading chunk — is
fired anyway, so a volley never leaves live TNT behind.

The radius scales with the shell count rather than staying put. Five thousand
shells inside the old 40-block radius would sit a third of a block apart,
sixteen deep in the same crater; at 100 they land about 1.6 blocks apart, which
is still heavy overlap for a blast that clears four.

**Tactical Nuke** — a five-second countdown, then a bowl **200 blocks across
and 30 deep**, carved out block by block at 12,000 blocks a tick under a rising
mushroom cloud and an expanding shockwave. Clearing blocks directly rather than
exploding them is what makes this size possible — the Bedrock version of this
weapon had to settle for 120 blocks across precisely because explosions were
all it had.

**Kamehameha** — charge through KA-ME-HA-ME-HAAA, one syllable every half
second, with a ball of ki swelling at your hands. Aim is read at the moment of
firing rather than when the charge began, so you can track a target while
winding up. The beam then bores an 11-block tunnel 160 blocks ahead.

Here the beam is drawn with particles — `end_rod` for the white-hot core,
`soul_fire_flame` for the blue sheath. The Bedrock version had to string
hundreds of cube entities along the line to get a visible shaft; this costs no
entities at all.

**Black Hole** — a singularity that eats a sphere **350 blocks across**: about
22.4 million blocks, roughly eighteen times the nuke. It opens at the centre and
spreads outward rather than raining down, drags every entity within 220 blocks
toward the middle, and tears loose blocks near its edge into falling debris that
spirals in. Then it collapses.

Eighteen times, not more, because more isn't possible. Minecraft only keeps
chunks loaded a couple of hundred blocks around a player, and blocks in unloaded
chunks don't exist to be removed — a bigger radius would just delete air. A
175-block radius sits about eleven chunks out, just inside that edge. It also
leaves bedrock alone: punching through the world floor opens a hole into the
void that can never be repaired.

**Orbital Laser** — right-click to bring it online, right-click again to cease
fire, or let it run its twenty seconds. While it burns it cuts a **15-block
column from above your aim straight down to bedrock**, and it re-reads where
you are looking *every tick* — so walking or turning drags a canyon behind you
instead of stamping out one crater.

That steering is the whole point of it. Every other weapon here decides its
shape at the instant it fires; this one is aimed continuously, which makes it
the only one you can cut a line with.

It costs much less than its reach suggests. The beam sits over ground it
cleared last tick, so almost every block it looks at is already air and only
the leading edge does real work — sweeping it is cheaper than holding it still
is expensive.

Two things worth knowing before you fire it: it explodes at the impact point
every half second, which is what makes it hurt anything standing in the beam —
including you, if you aim at your own feet. And what it cuts goes all the way
down, so looking straight down opens a hole to bedrock underneath you.

**Rewind Clock** — right-click and the last **thirty seconds** of damage is put
back. The only thing here that builds rather than destroys, and the only answer
to the rest of the arsenal: fire the black hole into your own base and this is
what gets it back.

It works off a rolling record of what the world used to look like. Every block
change is filed with the state that stood there before it, grouped by the tick
it happened on; replaying those backwards, newest first, walks the world back.
Newest-first is the only order that gets a block changed several times inside
the window right — it ends on the state it held at the start rather than
somewhere in the middle.

Mobs need the opposite treatment, which is why they are recorded separately. A
block only ever exists at a position, so replaying its changes restores it
exactly. A mob moves, and can also stop existing — so it takes two records:
where everything was standing, sampled a few times a second, and a list of
what died. Positions need only the *oldest* sample replayed rather than every
one, since walking all 150 of them backwards ends in exactly the same place
having done the work 150 times.

Three limits, all of them reachable in normal use of this mod:

**Mobs come back, but as new animals.** Everything that died inside the window
is put back on its feet where it fell, keeping its name, and every surviving
mob is returned to where it was standing. What does not survive the trip is
everything else about it: a tamed wolf comes back wild, a villager comes back
without its trades, and nothing comes back holding what it was carrying.
Restoring that needs a mob's full saved state, and those calls were reworked in
recent versions to something I had no way to verify — so this does the part
that can be done correctly instead of the part that might silently do nothing.

Players are deliberately left out of both halves. A dead player is put back by
the game's own respawn, with their inventory and their bed, and quietly
duplicating one here would be worse than doing nothing; and dragging the person
holding the clock backwards through the world is not an undo, it is a shove.

Dropped items also stay dropped.

**Very large events overrun it.** The record caps at two million changes, which
is about forty megabytes. The black hole alone makes twenty-two million, so its
oldest changes are evicted while it is still digging and an undo afterwards
restores only the last part of it. The cap is there because the alternative is
running the game out of memory, which is a worse answer than an incomplete
undo. The nuke, at 1.27 million, fits comfortably.

**It records everything, always.** Not just this mod's weapons — a creeper, a
fire, a pickaxe, another mod. That is affordable because a normal world barely
changes: a few hundred blocks a second at the very outside, against a record
sized for the twenty-two million a black hole makes. An idle world costs a map
lookup and an array append per block change.

The sharp edge of that is worth saying plainly: the clock undoes the last
thirty seconds of *everything*. Blocks you placed in that window are un-placed
too. It is an undo, not a repair tool.

That last point is also why this is the only part of the mod that needs a
mixin. The cannon and the meteor storm break blocks through vanilla's explosion
code, which the mod never sees — so the clock hooks the one place every block
change in the game passes through. The injection is marked `require = 0`: if
that method's shape ever moves, the hook quietly does nothing rather than
refusing to load the mod, the clock keeps its reach over everything this mod
clears directly, and the rest of the arsenal is unaffected.

**Potato Bomb** — 300 charges over a **70-block circle**, and then the crater
gets planted. Once the last shell has gone off, the whole floor is tilled and
sown with potatoes, so the thing that just flattened the hillside also feeds
you. The only weapon here that gives something back.

The planting waits on the blast rather than running alongside it. Shells go off
when they land, and the last of them can still be falling several seconds after
the first detonates — sowing any earlier would plant a field and then blow it
up. It also walks *down* to find the floor rather than planting at the height it
was aimed at, because after a blast the ground is nowhere near where it started.

**Time Stop Clock** — the world stops dead for **fifteen seconds** and you keep
moving. Mobs stand still mid-stride, arrows hang in the air, lit TNT stops
counting down, fluids stop flowing and the sun stops climbing — and you walk
through all of it, mining and building and swinging as normal. Right-click
again to let time go early.

**Slow Motion Clock** — the world drops to **quarter speed for twenty seconds**
while you carry on at your own. Where the Time Stop is absolute, this leaves
the world moving: mobs still come for you, slowly enough to walk around, and a
lit TNT gives you four times as long to get clear.

Both ride Minecraft's own tick manager — the machinery behind `/tick freeze`
and `/tick rate` — rather than anything invented here. That matters most for
the freeze, because **vanilla's freeze already exempts players by design**.
Doing it by hand would mean finding and pausing every mob, projectile, falling
block, fluid, redstone circuit and block entity in the world, and getting one
of them wrong is a mob that keeps walking toward you while time is stopped.

Two things fall out of using the real tick rate rather than faking one. Only
one clock can be running at a time — freezing on top of a slowdown would leave
the rate to be restored by whichever timer fired last, and that failure mode is
a world stuck at quarter speed with no way back. And the slowdown's own
countdown has to be measured on the slowed clock: server ticks arrive five
times a second instead of twenty, so waiting the usual number of them would
stretch twenty seconds into eighty.

**Echo Ghost** — press it and a translucent copy of you appears, replaying the
**ten seconds you just lived**: the same path, the same turns, the same look up
at the sky. Press it again for another. They accumulate.

They are not copies of each other, which is the point. Each ghost takes its own
snapshot of your past at the moment it is made, so walk somewhere, press, walk
somewhere else, press — and the two of them are doing different things at once.
Crouch and right-click to send them all away.

Everyone's last ten seconds is recorded all the time, so the ghost appears the
instant you press rather than starting a recording and making you wait for it.
That is the whole feel of the item: you do something worth watching, and then
you stand back and watch yourself do it. Ghosts loop rather than stopping at
the end of their path — one that freezes after ten seconds looks broken, one
that starts its walk again looks haunted.

**Echo Beacon** — the same ghosts, raised on a timer instead of by hand. Switch
it on and a new echo joins you **every sixty seconds**, each replaying whatever
you happened to be doing when its minute came round. Leave it running and you
slowly acquire a crowd. Right-click again to switch it off.

Both cap at 24 ghosts per player, oldest discarded first. Both items exist to
accumulate, and without a ceiling the beacon would keep going all night until
the server was carrying a thousand entities nobody asked for — dropping the
oldest keeps the crowd the size it is rather than simply refusing to grow.

The ghosts are quiet: they walk your path and glow, and that is all. They do
not fight.

**Fast Forward Clock** — the third clock, and the one that builds rather than
waits: **five times speed for fifteen seconds**. Crops mature while you watch, a
furnace burns through a stack, mobs breed, night passes. Fifteen rather than the
slow clock's twenty because this is the expensive direction — the server really
does five times the work per second while it runs.

**Ore Sense** — a pulse that lights every ore within **32 blocks through solid
stone** for ten seconds. The only item here that takes nothing away.

Colour comes from picking a different vanilla particle per ore rather than
tinting one: green villager motes for emerald, blue soul flame for lapis, white
end rod for diamond. Tinted dust is the obvious way and needs a particle that
carries a colour parameter — and parameterised particles have changed shape more
than once between versions. These take no parameters at all, so they cannot
break that way.

**Bottled Chunk** — copy and paste the world. Right-click to draw a **16×16×16
region** into the bottle, crouch and right-click elsewhere to set it back down.
Steal a village house, carry it a thousand blocks, and rebuild it with the
torches still lit.

Copying leaves the original alone, which is the useful default by a wide
margin — a bottle that ate what it copied would make every mistake permanent.
Pasting goes through the same record the Rewind Clock reads, so a paste in the
wrong place is one right-click away from gone.

The bottle holds one region per player rather than storing it in the item.
Putting four thousand block states inside an item stack means custom item
components, and those have been reworked more than once recently; this needs
none of it, at the cost of the copy being forgotten when the server stops.

## How it's put together

```
OrbitalArsenal.java     mod entrypoint, registers items and the tick hook
ModItems.java           the three registrations and the creative tab
Scheduler.java          a tick queue
weapons/Formation.java  concentric ring layout
weapons/Shells.java     TNT that detonates on impact rather than on a timer
time/TimeControl.java   freezing and slowing, through the vanilla tick manager
echo/Echoes.java        rolling movement memory, and the ghosts that replay it
weapons/Strikes.java    aiming, explosions, particles
items/*.java            one class per weapon
time/Journal.java       the rolling record the rewind clock replays
mixin/*.java            the one hook that sees block changes this mod did not make
make_icon.py            generates the newer item icons
```

Every weapon spreads its work across ticks through `Scheduler` rather than
doing it in one. That isn't decoration: the nuke's crater is over a million
blocks, and doing that in a single tick would stall the server outright.

## Tuning

Constants sit at the top of each item class: `SHELLS` / `RADIUS` / `RINGS` and
`DROP_HEIGHT` for the cannon, `RADIUS` / `DEPTH` / `BLOCKS_PER_TICK` for the
nuke (lower the last one if it stutters — it stretches the dig rather than
shrinking the crater), `RANGE` / `BORE` / `STRIDE` for the kamehameha, and
`BORE` / `MAX_TICKS` / `FLOOR` for the laser.
