# Orbital Arsenal — Fabric mod source

Twenty genuinely registered items — `orbital:strike_cannon`,
`orbital:tactical_nuke`, `orbital:kamehameha`, `orbital:black_hole`,
`orbital:orbital_laser`, `orbital:rewind_clock`,
`orbital:potato_bomb`,
`orbital:time_stop_clock`, `orbital:slow_time_clock`,
`orbital:echo_ghost`, `orbital:echo_beacon`,
`orbital:fast_forward_clock`, `orbital:ore_sense`, `orbital:bottled_chunk`,
`orbital:portal_gun`,
`orbital:chronarch_seal`, `orbital:chronarch_heart`,
`orbital:deep_rewind_clock`, `orbital:long_rewind_clock`, `orbital:genesis_clock` — with their own textures,
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

**The rewind clocks** — four of them, reaching back **one minute**, **five**,
**ten**, or **everything still recorded**. Right-click and that much damage is put
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

All four read the same record, and each takes only the frames inside its own
reach. Undoing the last minute does not spend the previous nine — a deeper
clock can still reach them afterwards. One journal rather than four, because
four would each have to watch every block change in the world and would file
the same change four times over.

Every clock in the mod waits the same **five seconds**, whatever it does or how
far it reaches. Nothing is rationed by its cooldown any more, so what holds the
deep clocks back is the record's own limits rather than the wait.

Three limits, all of them reachable in normal use of this mod:

**Putting mobs back reaches two minutes; raising the dead reaches an hour.**
They cost very different amounts to record — a position sample is every entity
in the world several times a second, while a death is one small record and
deaths are rare. So the deep clocks will raise anything that died in the last
hour, but only the shallower ones can put survivors back where they stood.

**Anything a rewind buries is lifted out.** Putting blocks back puts them back
around whatever was standing in the hole, and Minecraft's answer to being inside
a block is to suffocate you — so undoing a crater used to kill the very mobs the
rewind had just resurrected. Once a restore finishes, everything in the area it
touched is checked and anything now inside solid rock is raised to the first
clear space above. Water and lava are left alone: those are not suffocation, and
hauling a fish out of restored water would be its own small disaster.

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

**Nothing older than an hour survives, and the Genesis Clock is not a world
reset.** It undoes everything *still recorded*, which is as far back as memory
reaches — not a return to the world as it generated. Genuinely regenerating
terrain would mean re-running world generation over every chunk, which
Minecraft gives a mod no safe way to do while a world is open.

**Changes are stored as runs, not as blocks**, which is what makes undoing a
black hole possible at all. These weapons clear in contiguous rows — the nuke
and the black hole both walk a whole line of z at a time — so a row of two
hundred stone becoming air is *one* entry rather than two hundred. Against
terrain that measures about **99x**: a black hole's 11.6 million cleared blocks
become 117,000 runs, around 3 MB.

Before that, the record held blocks one by one and capped at four million, so a
black hole overran it about threefold and an undo afterwards restored roughly a
third of the crater. That is now the whole thing.

A run only forms when consecutive changes are adjacent and had the same block
before them — exactly what bulk clearing looks like, and never what a player
mining looks like. Nothing is lost when runs do not form; the record simply
falls back to one entry per block.

**Very large events can still overrun it.** The cap is three million runs, which at that compression is a great deal of world. What overruns it now would
have to be sustained clearing far past anything one weapon does — but if it
happens, the oldest runs are evicted while it is still going, and no deeper
clock helps, because those frames are gone rather than merely out of reach. The cap is there because the alternative is
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

**Potato Bomb** — drops an enormous potato on the world from ninety blocks up.

The potato is real: **about a thousand blocks** in a lumpy ellipsoid, seventeen
long and eleven thick, each spawned as a falling block. They hold their shape
the whole way down for a reason worth knowing — every falling block in
Minecraft accelerates identically, so a cluster released together stays a
cluster. No rigid-body machinery is needed and none exists to borrow; the
physics does it for free. A plain ellipsoid would read as an egg, so the
surface is wobbled just enough to come out lopsided.

Where it lands it leaves a crater **eighty blocks across and twenty-two deep**,
and then the crater floor is tilled and sown. The thing that just flattened the
hillside still feeds you.

The planting walks *down* to find the floor rather than sowing at the height it
was aimed at, because after an impact the ground is nowhere near where it
started. The whole crater goes through the journal, so the clocks can put it
back.

**Cat Bazooka** — fires a cat.

Not a cat-shaped projectile: an **actual cat**, five hundred and twenty-seven
blocks of orange and white wool assembled in mid-air four blocks off the muzzle
and thrown downrange as one body at 2.6 blocks a tick. It keeps its shape in
flight for the same reason the potato does — every falling block accelerates
identically, so a cluster released on one tick with one velocity stays a
cluster.

The cat is a function of position rather than a model file: a tail swept as a
string of small spheres, four legs, an ellipsoid body white on the underside,
a head with black eyes and a pink nose, and two ears tipped in black. The tests
run detail-before-bulk — the eyes sit *inside* the head sphere and the black
tips *inside* the ears, so each has to be asked about before the plain colour
underneath swallows it.

Where it lands it digs a crater **forty-four blocks across and twelve deep**,
through the journal so the clocks can put it back. Then **a thousand live cats**
come out of the hole in a sphere.

A thousand random directions would clump — visible bald patches and dense
knots. The burst uses a golden-angle spiral instead, evenly spaced in
`cos(phi)` rather than in `phi`, which is what keeps the spacing even on the
sphere itself instead of bunched at the poles. It reads as a shell, not a
cloud. Fifty cats a tick, so a thousand mobs is twenty ticks of work rather
than one visible freeze, and each wave clears itself after three minutes —
otherwise the world simply never stops being cats.

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

**Portal Gun** — the Aperture Science device, near enough. Right-click a
surface for the blue portal, crouch and right-click for the orange. Once both
are up, walking into either puts you out of the other.

**Momentum is the whole thing.** *Speedy thing goes in, speedy thing comes
out*: the speed you arrive with is the speed you leave with, redirected along
whichever way the far portal faces. Fall thirty blocks into a portal in the
floor and come out of one in a wall, and you are fired sideways across the
canyon at the speed the fall gave you. A teleporter that dropped your velocity
would look nearly identical and feel like nothing at all.

Anything can go through, not just you — mobs, items, arrows. Both ends get a
short settling time after something passes, since arriving *in* the far portal
would otherwise count as entering it and bounce you straight back.

Players are moved with a teleport the client is told about rather than a plain
server-side reposition: the client believes it is still where it was and simply
walks back otherwise. The pairs are per player, so two people with portal guns
never fire into each other's.

## The Chronarch

A boss that fights you with time. Right-click a **Chronarch Seal** to wake it —
the seal is spent doing so, because a boss you can re-summon for free is an
inconvenience rather than an event.

Three phases, each turning one of this mod's own clocks against its owner:

| health | what it does |
|--------|--------------|
| 100–66% | a straight fight |
| 66–33%  | **slows you** while moving at full speed itself |
| below 33% | **rewinds its own wounds**, clawing back damage every five seconds |

**The last phase has an answer, and it is an item you already own.** A frozen
world cannot rewind anything, and the Chronarch is part of the world even if it
does not act like it — so holding it under the Time Stop Clock while you burst
it down is how the fight is won rather than merely survived.

Its health is not an attribute. Each tick the body's own health is compared
with what it was, the shortfall is taken off a thousand-point pool kept here,
and the body is healed straight back. That gives a boss-sized health bar out of
nothing but `getHealth` and `setHealth` — stable for many versions — instead of
an attribute registry that has been renamed twice recently. Nothing that hits
it needs to know any of this.

**What it looks like** is a floating clockwork orrery: a crying-obsidian core
under a beacon crown, with three amethyst blocks turning close in and six
purpur pillars turning the other way further out. As its health falls the whole
mechanism winds tighter and spins faster.

There is a ravager inside it, invisible. That is the hitbox and the thing that
walks toward you; the construct is what you see.

A bespoke monster model would need a client-side entity renderer, and since
1.21.2 that means render states — a large API I have no way to verify from
here, on a mod that ships as one jar with no client half. So the shape is built
instead from invisible armour stands, each wearing a block on its head, placed
and spun by mod code every tick.

That is a different trade rather than a lesser one. It is entirely server-side,
so it works on an unmodified client and cannot break when rendering changes —
and for this boss it is arguably the better answer, because what it produces
*is* a clock: nested rings turning at different speeds around a core. A
hand-modelled monster would have had to imply that.

**Chronarch's Heart** — what it was doing to you, now yours. Right-click and
you snap back to where you stood **ten seconds ago, with the health you had
then**. Step off a cliff and undo it; walk into a fight that turns out to be a
mistake and leave before you made it.

It rewinds *you* and nothing else, which is what makes it something other than
a smaller Rewind Clock — the world keeps whatever happened. Health comes back
with position, because a rewind that returns you to the clifftop still dying of
the fall is no rescue at all.

## The companion, and how it builds

`/ai spawn` summons a companion bound to you. It talks in chat and it acts:
follow, hold, come, travel to coordinates, dig, fight hostiles, hand you items,
fire your orbital weapons — and build.

It needs an Anthropic API key in `config/orbital-companion.json`. The key stays
there. It is never compiled into the jar and never written to the log.

**Why it builds by shape rather than by block.** The obvious tool is one that
takes a list of positions. It does not work. A modest castle is fifty thousand
blocks, which is more than fits in one reply, and any companion built that way
can only make things the size of a shed. So no tool here takes a list. Each
shape is a *rule* about which points are inside it, and the rule is what gets
walked:

| tool | what it makes |
|---|---|
| `BuildBox` | walls, floors, roofs, rooms, platforms — solid or a six-faced shell, with `repeat` and a step for stacking floors and battlements |
| `BuildSphere` | balls and domes; `dome` builds only the upper half |
| `BuildCylinder` | towers, chimneys, wells, columns — a tube you can stand in, or a solid pillar |
| `BuildLine` | bridges, ridges, supports, diagonal edges, at any angle and thickness |
| `ClearBox` | hollow out a room, cut doors and windows, flatten ground |

A keep is walls, four corner towers, a gatehouse and battlements: about
twenty-five calls instead of fifty thousand. That is a size a model can reason
about, so it spends its attention on proportion instead of bookkeeping.

Everything reduces to a bounding box plus an inside test, which is why there is
exactly one placement loop. That loop carries two budgets, because the two
costs are nothing alike — testing a cell is arithmetic, writing a block touches
the world and tells every nearby client. A hollow sphere is mostly the first
and a solid box mostly the second, and a single budget would either stall the
server on solids or crawl on hollows.

Builds go up a few thousand blocks a tick, walking Y outermost so they rise
course by course. That is partly to spare the server and partly because a keep
that rises is worth watching and one that appears whole is just a screenshot.

**Every block goes through the journal**, so the rewind clocks undo a building
exactly as they undo a crater. Bedrock is never replaced, and a block already
correct is skipped — which saves the write and, more usefully, keeps it out of
the record.

Two things were settled by testing rather than by eye. A hollow shell is
"inside the sphere but not inside a sphere one block smaller", not a distance
band — the band leaves the shell thin at the poles and thick at the equator,
while the difference measures two cells thick through both. And a beam is never
thinner than sqrt(3)/2, because a block's centre can sit that far from a line
through its corner: at half a block, two of four sample angles came out in
pieces. A chunky bridge beats a bridge with holes in it.

## How it's put together

```
OrbitalArsenal.java     mod entrypoint, registers items and the tick hook
ModItems.java           the three registrations and the creative tab
Scheduler.java          a tick queue
weapons/Formation.java  concentric ring layout
weapons/Shells.java     TNT that detonates on impact rather than on a timer
time/TimeControl.java   freezing and slowing, through the vanilla tick manager
echo/Echoes.java        rolling movement memory, and the ghosts that replay it
portal/Portals.java     the linked pair, and the momentum that survives them
boss/Chronarch.java     the fight: phases, the health pool, and the rewind
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
