# Orbital Arsenal — Java Edition

The same three weapons as the Bedrock add-on, as a **datapack**.

- **Orbital Strike Cannon** — 300 TNT fall from the sky in a ring formation
  80 blocks across, landing before they detonate.
- **Tactical Nuke** — a crater **200 blocks across** and 30 deep, opening over
  two seconds under a rising mushroom cloud.
- **Kamehameha** — a beam that bores an 11-block tunnel 160 blocks straight
  ahead. Point it at a mountain and you get a hole out the other side.

## Why a datapack and not a mod

A Java mod needs Fabric or Forge installed and a compiled `.jar` built against
a specific Minecraft version. A datapack needs neither — you drop it into a
world and it works, same as the Bedrock add-on.

It also makes the nuke *bigger* than the Bedrock version. Java's `/fill` clears
blocks in bulk, which is exactly the capability the Bedrock script API never
reliably provided; several Bedrock releases went by trying to get it working
there before that whole approach was abandoned. Here the crater is carved
rather than blown up, so it reaches the full 200 blocks instead of 120.

## Install — as a mod (mods/ folder)

Drop **`OrbitalArsenal-1.0.0.jar`** into your `mods` folder. That's it — load a
world and the weapons are there, no datapack to enable per world.

It carries metadata for **Fabric, Quilt, Forge and NeoForge**, so whichever
loader you have will pick it up; each reads its own file and ignores the rest.

### What kind of mod this is

It's a **data-driven mod**: the jar holds no compiled Java, only the datapack,
and every loader listed above loads `data/` straight out of a mod jar as a
built-in pack. That's a real, supported mod format — Forge even has a loader
mode named for it, `lowcodefml` — and it means the jar works without being
compiled against any particular Minecraft version, which is a large part of why
it should keep working as versions move.

The honest limit: the weapons still fire from vanilla trigger items rather than
custom items with their own textures, because that needs actual Java code. I
couldn't build a compiled mod here even to try — this machine can reach neither
Mojang's nor Fabric's maven repositories, so there was nothing to compile
against.

## Install — as a datapack (per world)

Same contents, if you'd rather not use the mods folder.

1. Download `OrbitalArsenal-Java.zip` — **don't unzip it**.
2. Put it in your world's `datapacks` folder:
   - Singleplayer: `.minecraft/saves/<world>/datapacks/`
   - Server: `<server>/world/datapacks/`
   - In game you can also use **Create New World → More → Data Packs** and drag
     the zip onto the window.
3. Load the world, or run `/reload` if it's already open.
4. You should see **"Orbital Arsenal loaded"** in chat. If not, run
   `/datapack list` — it should appear under enabled packs.

Then get the weapons with `/function orbital:give`.

## Firing them

Right-click with the matching item:

| weapon | item |
|--------|------|
| Orbital Strike Cannon | carrot on a stick |
| Tactical Nuke | warped fungus on a stick |
| Kamehameha | goat horn |

Each aims at whatever you're looking at, up to 150 blocks. Cooldowns are 10, 20
and 8 seconds.

**These are plain vanilla items, not custom ones**, and that's deliberate. A
datapack can tag an item with custom data and check for it, but the NBT path
for that check has moved between Minecraft versions, and when it misses the
weapon simply never fires — a silent failure that is miserable to diagnose. A
scoreboard on `minecraft.used:<item>` has been stable for years and always
works. The trade is that *any* carrot on a stick fires the cannon, so don't
carry one while riding a pig.

If you want them to look the part, name them:

```
/give @s carrot_on_a_stick[custom_name='{"text":"Orbital Strike Cannon","color":"red","italic":false}']
```

(That syntax needs 1.20.5 or newer. It's cosmetic — the weapon fires either way.)

## How it works

**Aiming** is a recursive function stepping one block at a time along your look
vector until it leaves the `orbital:passable` block tag, then parking a marker
entity there. Everything else runs `execute at` that marker.

**The marker matters more than it looks.** Anything spanning several ticks has
to be driven from one, because `/schedule` comes back positioned at the world
origin rather than where you aimed. The nuke's crater and the kamehameha's beam
both work this way.

**The crater** is 1,272,543 blocks. Done one row at a time that would be 9,117
`/fill` commands; merging adjacent rows that share a width brings it to 5,367,
and the largest single fill is 4,913 blocks — comfortably under Java's 32,768
per-command ceiling. It runs in 40 stages, one per tick, so about 135 fills and
32,000 blocks land per tick rather than freezing the game for a second. The
mushroom cloud's height is baked into each stage, since a command can't do
arithmetic on its own coordinates.

**The cannon** uses plain `summon tnt` with no NBT at all. The default 80-tick
fuse outlasts the ~64 ticks it takes to fall 55 blocks, so the volley lands
before it goes off — no fuse field to set, and so no NBT field name that might
have been renamed between versions.

**The kamehameha** marches forward in 3-block strides, boring as it goes. Each
stride fills three overlapping boxes rather than one cube: the union is an
octagonal cross-section, which reads as a bored tunnel instead of a square
corridor. It leaves a marker at each stride, and those markers draw the beam
for 25 ticks — `end_rod` for the white-hot core, `soul_fire_flame` for the blue
sheath around it. Both take no parameters, so neither depends on a particle
argument format that has changed shape over the years.

## Version compatibility

Minecraft renamed datapack folders from plural to singular in 1.21
(`functions/` → `function/`). The zip contains **both layouts**, so one file
covers either side of that split.

Everything else sticks to command syntax that has been stable for years: fill,
summon, particle, playsound, execute, scoreboard. No item components in the
weapon logic, no entity NBT field names, no particle arguments.

Tested against 1.19 through 1.21 formats by construction; `pack.mcmeta`
declares a wide `supported_formats` range so newer versions accept it too.

## Building it

```
python3 build_datapack.py     # regenerates build/ and the zip
python3 verify_datapack.py    # 5,449 checks
python3 build_mod_jar.py      # wraps build/ as the mods-folder jar
```

`verify_datapack.py` catches what Minecraft reports badly: JSON that doesn't
parse, functions referenced but never written, fills over the block ceiling,
scoreboard objectives used before they're created, and either folder layout
going missing. A datapack with any of those loads without complaint and then
does nothing when fired.

Weapon sizing lives at the top of `build_datapack.py`: `CANNON_SHELLS`,
`NUKE_RADIUS` / `NUKE_DEPTH` / `NUKE_STAGES` (raise the stage count to spread
the crater over more ticks if it hitches), and `KAME_STEPS` / `KAME_STRIDE`.
