# Orbital Arsenal — Fabric mod source

Four genuinely registered items — `orbital:strike_cannon`,
`orbital:tactical_nuke`, `orbital:kamehameha`, `orbital:black_hole` — with
their own textures, names, creative tab entries and crafting recipes.

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
across** from 55 blocks up, spawned 200 per tick. Their fuse outlasts the fall
on purpose, so the volley lands before any of it goes off rather than
airbursting on the way down — and that has to hold for the *last* shell
spawned, not the first: it lands at tick 89 against a fuse that fires at 105.

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

## How it's put together

```
OrbitalArsenal.java     mod entrypoint, registers items and the tick hook
ModItems.java           the three registrations and the creative tab
Scheduler.java          a tick queue
weapons/Formation.java  concentric ring layout
weapons/Strikes.java    aiming, explosions, particles
items/*.java            one class per weapon
```

Every weapon spreads its work across ticks through `Scheduler` rather than
doing it in one. That isn't decoration: the nuke's crater is over a million
blocks, and doing that in a single tick would stall the server outright.

## Tuning

Constants sit at the top of each item class: `SHELLS` / `RADIUS` / `RINGS` and
`DROP_HEIGHT` for the cannon, `RADIUS` / `DEPTH` / `BLOCKS_PER_TICK` for the
nuke (lower the last one if it stutters — it stretches the dig rather than
shrinking the crater), `RANGE` / `BORE` / `STRIDE` for the kamehameha.
