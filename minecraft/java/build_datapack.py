#!/usr/bin/env python3
"""Generate the Java Edition datapack for the Orbital Arsenal.

Java gets a datapack rather than a mod: no Fabric or Forge to install, just
drop the zip into a world's datapacks folder. It also gets a bigger nuke than
Bedrock, because `/fill` clears blocks in bulk — the one thing the Bedrock
script API never reliably gave us — so the crater is carved rather than blown.

Two things shape almost every decision here:

* Commands drift between versions, so this sticks to syntax that has been
  stable for years: fill, summon, particle, playsound, execute, scoreboard.
  No item components, no entity NBT field names that have been renamed.
* Scheduled functions lose their position, so anything that has to run over
  several ticks parks a marker entity at the spot and runs `execute at` it.

Run: python3 build_datapack.py
"""
import json
import math
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "build"
NS = "orbital"

# --- weapon sizing ----------------------------------------------------------
CANNON_SHELLS = 300
CANNON_RADIUS = 40
CANNON_RINGS = 10
CANNON_HEIGHT = 55  # TNT's default 80-tick fuse outlasts a fall from here

NUKE_RADIUS = 100  # 200 blocks across
NUKE_DEPTH = 30
NUKE_ABOVE = 25
NUKE_STAGES = 40  # one per tick, so the crater opens over two seconds

KAME_STEPS = 54
KAME_STRIDE = 3  # blocks between bore points
KAME_GLOW_TICKS = 25  # how long the beam stays lit


def ring_formation(count, radius, rings):
    """Concentric rings, shells shared out by circumference so spacing is even.

    The same layout the Bedrock pack uses: each ring is twisted by a golden
    ratio turn, or shells in neighbouring rings line up and the circle reads
    as spokes instead of a disc.
    """
    radii = [(i / rings) * radius for i in range(1, rings + 1)]
    total = sum(radii)
    points = [(0.0, 0.0)]
    assigned = cumulative = 0
    for index, r in enumerate(radii):
        cumulative += r
        target = round(((count - 1) * cumulative) / total)
        share = target - assigned
        assigned = target
        twist = index * 0.6180339887 * math.tau
        for s in range(share):
            angle = twist + (s / share) * math.tau
            points.append((math.cos(angle) * r, math.sin(angle) * r))
    return points


def crater_fills():
    """The bowl, as `/fill` commands with adjacent equal-width rows merged.

    Merging matters: row at a time this is 9,117 commands, merged it is 5,367,
    and every one of them still sits far under fill's 32,768 block ceiling.
    """
    def radius_at(dy):
        if dy >= 0:
            return NUKE_RADIUS if dy <= NUKE_ABOVE else 0
        below = -dy
        return 0 if below > NUKE_DEPTH else NUKE_RADIUS * math.sqrt(1 - below / NUKE_DEPTH)

    commands = []
    for dy in range(NUKE_ABOVE, -NUKE_DEPTH - 1, -1):
        r = radius_at(dy)
        if r <= 0:
            continue
        runs, previous, start = [], None, None
        span = int(r)
        for x in range(-span, span + 1):
            half = int(math.sqrt(max(0, r * r - x * x)))
            if half != previous:
                if previous is not None:
                    runs.append((start, x - 1, previous))
                start, previous = x, half
        runs.append((start, span, previous))
        for x1, x2, half in runs:
            commands.append(
                f"fill ~{x1} ~{dy} ~{-half} ~{x2} ~{dy} ~{half} air"
            )
    return commands


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text if text.endswith("\n") else text + "\n")


def build():
    if OUT.exists():
        shutil.rmtree(OUT)

    functions = {}

    # --- setup and the per-tick driver --------------------------------------
    functions["load"] = f"""
# Right-clicking these three vanilla items is what fires each weapon. Reading a
# custom tag off the held item would be tidier, but the NBT path for that has
# moved between versions and a silent miss means the weapon simply never fires.
scoreboard objectives add {NS}.cannon minecraft.used:minecraft.carrot_on_a_stick
scoreboard objectives add {NS}.nuke minecraft.used:minecraft.warped_fungus_on_a_stick
scoreboard objectives add {NS}.kame minecraft.used:minecraft.goat_horn
scoreboard objectives add {NS}.cd dummy
scoreboard objectives add {NS}.range dummy
scoreboard objectives add {NS}.step dummy
scoreboard objectives add {NS}.stage dummy
scoreboard objectives add {NS}.beam dummy
scoreboard players set #{NS} {NS}.stage 0
scoreboard players set #{NS} {NS}.beam 0
tellraw @a ["",{{"text":"Orbital Arsenal ","color":"aqua","bold":true}},{{"text":"loaded — carrot on a stick = cannon, warped fungus on a stick = nuke, goat horn = kamehameha","color":"gray"}}]
""".strip()

    functions["tick"] = f"""
scoreboard players add @a {NS}.cd 0
scoreboard players remove @a[scores={{{NS}.cd=1..}}] {NS}.cd 1

execute as @a[scores={{{NS}.cannon=1..,{NS}.cd=0}}] at @s run function {NS}:cannon/fire
execute as @a[scores={{{NS}.nuke=1..,{NS}.cd=0}}] at @s run function {NS}:nuke/fire
execute as @a[scores={{{NS}.kame=1..,{NS}.cd=0}}] at @s run function {NS}:kame/fire

scoreboard players set @a {NS}.cannon 0
scoreboard players set @a {NS}.nuke 0
scoreboard players set @a {NS}.kame 0

# Work that spans ticks runs from a marker, because a scheduled function would
# come back positioned at the world origin instead of at the target.
execute if score #{NS} {NS}.stage matches 1.. run function {NS}:nuke/dispatch
execute if score #{NS} {NS}.beam matches 1.. run function {NS}:kame/draw
""".strip()

    # --- raycast ------------------------------------------------------------
    functions["ray/cast"] = f"""
kill @e[type=marker,tag={NS}.target]
scoreboard players set @s {NS}.range 150
execute anchored eyes positioned ^ ^ ^1 run function {NS}:ray/step
""".strip()

    functions["ray/step"] = f"""
scoreboard players remove @s {NS}.range 1
execute if score @s {NS}.range matches ..0 run function {NS}:ray/land
execute if score @s {NS}.range matches 1.. unless block ~ ~ ~ #{NS}:passable run function {NS}:ray/land
execute if score @s {NS}.range matches 1.. if block ~ ~ ~ #{NS}:passable positioned ^ ^ ^1 run function {NS}:ray/step
""".strip()

    functions["ray/land"] = f"summon marker ~ ~ ~ {{Tags:[\"{NS}.target\"]}}"

    # --- cannon -------------------------------------------------------------
    functions["cannon/fire"] = f"""
scoreboard players set @s {NS}.cd 200
title @s title {{"text":"☄ ORBITAL STRIKE ☄","color":"red","bold":true}}
title @s subtitle {{"text":"Incoming: {CANNON_SHELLS} TNT","color":"gold"}}
playsound minecraft:entity.wither.spawn master @a ~ ~ ~ 50 0.6
function {NS}:ray/cast
execute at @e[type=marker,tag={NS}.target,limit=1] run function {NS}:cannon/volley
kill @e[type=marker,tag={NS}.target]
""".strip()

    volley = [
        "# Plain `summon tnt` on purpose: the default 80-tick fuse outlasts the",
        f"# ~64 ticks it takes to fall {CANNON_HEIGHT} blocks, so the volley lands before it",
        "# goes off. Setting the fuse explicitly would mean naming an NBT field",
        "# that has been renamed between versions.",
    ]
    for dx, dz in ring_formation(CANNON_SHELLS, CANNON_RADIUS, CANNON_RINGS):
        volley.append(f"summon tnt ~{dx:.2f} ~{CANNON_HEIGHT} ~{dz:.2f}")
    functions["cannon/volley"] = "\n".join(volley)

    # --- nuke ---------------------------------------------------------------
    functions["nuke/fire"] = f"""
scoreboard players set @s {NS}.cd 400
title @s title {{"text":"☢ DETONATION ☢","color":"dark_red","bold":true}}
function {NS}:ray/cast
execute at @e[type=marker,tag={NS}.target,limit=1] run function {NS}:nuke/begin
kill @e[type=marker,tag={NS}.target]
""".strip()

    functions["nuke/begin"] = f"""
kill @e[type=marker,tag={NS}.crater]
summon marker ~ ~ ~ {{Tags:["{NS}.crater"]}}
scoreboard players set #{NS} {NS}.stage {NUKE_STAGES}
particle explosion_emitter ~ ~2 ~ 8 4 8 0 60 force
particle flash ~ ~2 ~ 6 3 6 0 25 force
playsound minecraft:entity.generic.explode master @a ~ ~ ~ 100 0.5
playsound minecraft:entity.wither.death master @a ~ ~ ~ 100 0.6
""".strip()

    dispatch = [
        f"execute at @e[type=marker,tag={NS}.crater,limit=1] run function {NS}:nuke/carve",
        f"scoreboard players remove #{NS} {NS}.stage 1",
        f"execute if score #{NS} {NS}.stage matches ..0 run kill @e[type=marker,tag={NS}.crater]",
    ]
    functions["nuke/dispatch"] = "\n".join(dispatch)

    carve = ["# Stage counts down, so stage N is the (STAGES - N)th slice of the bowl."]
    for i in range(NUKE_STAGES):
        carve.append(
            f"execute if score #{NS} {NS}.stage matches {NUKE_STAGES - i} "
            f"run function {NS}:nuke/stage_{i:02d}"
        )
    functions["nuke/carve"] = "\n".join(carve)

    fills = crater_fills()
    per_stage = math.ceil(len(fills) / NUKE_STAGES)
    for i in range(NUKE_STAGES):
        slice_ = fills[i * per_stage:(i + 1) * per_stage]
        # The mushroom cloud climbs as the crater digs — height is baked into
        # each stage, since a command can't do arithmetic on coordinates.
        height = 4 + i * 2
        spread = 2 + i * 0.35
        body = list(slice_)
        body.append(
            f"particle large_smoke ~ ~{height} ~ {spread:.1f} 1.5 {spread:.1f} 0.02 14 force"
        )
        if i > NUKE_STAGES // 2:
            cap = 6 + (i - NUKE_STAGES // 2) * 2.2
            body.append(
                f"particle large_smoke ~ ~{height} ~ {cap:.1f} 2 {cap:.1f} 0.03 20 force"
            )
        functions[f"nuke/stage_{i:02d}"] = "\n".join(body)

    # --- kamehameha ---------------------------------------------------------
    functions["kame/fire"] = f"""
scoreboard players set @s {NS}.cd 160
title @s title {{"text":"KA-ME-HA-ME-HAAA!","color":"aqua","bold":true}}
playsound minecraft:entity.warden_sonic_boom master @a ~ ~ ~ 40 1.4
kill @e[type=marker,tag={NS}.beam]
scoreboard players set @s {NS}.step {KAME_STEPS}
execute anchored eyes positioned ^ ^ ^2 run function {NS}:kame/march
scoreboard players set #{NS} {NS}.beam {KAME_GLOW_TICKS}
""".strip()

    functions["kame/march"] = f"""
scoreboard players remove @s {NS}.step 1
function {NS}:kame/bore
summon marker ~ ~ ~ {{Tags:["{NS}.beam"]}}
execute if score @s {NS}.step matches 1.. positioned ^ ^ ^{KAME_STRIDE} run function {NS}:kame/march
execute if score @s {NS}.step matches ..0 run function {NS}:kame/impact
""".strip()

    functions["kame/bore"] = """
# Three overlapping boxes rather than one cube: the union is an octagonal
# cross-section, which reads as a bored tunnel instead of a square corridor.
fill ~-5 ~-3 ~-5 ~5 ~3 ~5 air
fill ~-3 ~-5 ~-3 ~3 ~5 ~3 air
fill ~-4 ~-4 ~-4 ~4 ~4 ~4 air
""".strip()

    functions["kame/draw"] = f"""
execute at @e[type=marker,tag={NS}.beam] run function {NS}:kame/glow
scoreboard players remove #{NS} {NS}.beam 1
execute if score #{NS} {NS}.beam matches ..0 run kill @e[type=marker,tag={NS}.beam]
""".strip()

    functions["kame/glow"] = """
# end_rod is the white-hot core, soul_fire_flame the blue sheath around it —
# both take no parameters, so neither depends on a particle argument format.
particle end_rod ~ ~ ~ 0.35 0.35 0.35 0 5 force
particle soul_fire_flame ~ ~ ~ 0.9 0.9 0.9 0.01 9 force
""".strip()

    functions["kame/impact"] = """
particle explosion_emitter ~ ~ ~ 3 3 3 0 12 force
playsound minecraft:entity.generic.explode master @a ~ ~ ~ 60 0.8
fill ~-8 ~-8 ~-8 ~8 ~8 ~8 air
""".strip()

    functions["give"] = """
give @s carrot_on_a_stick
give @s warped_fungus_on_a_stick
give @s goat_horn
tellraw @s {"text":"Cannon, nuke and kamehameha — right-click to fire.","color":"aqua"}
""".strip()

    # --- lay the pack out ---------------------------------------------------
    # Minecraft renamed these folders from plural to singular in 1.21. Writing
    # both means one zip covers either side of that split.
    for fn_dir, tag_fn_dir, tag_block_dir in (
        ("function", "function", "block"),
        ("functions", "functions", "blocks"),
    ):
        for name, body in functions.items():
            write(OUT / "data" / NS / fn_dir / f"{name}.mcfunction", body)
        write(
            OUT / "data" / "minecraft" / "tags" / tag_fn_dir / "load.json",
            json.dumps({"values": [f"{NS}:load"]}, indent=2),
        )
        write(
            OUT / "data" / "minecraft" / "tags" / tag_fn_dir / "tick.json",
            json.dumps({"values": [f"{NS}:tick"]}, indent=2),
        )
        # `required: false` keeps a block that doesn't exist on this version
        # from failing the whole tag, and with it the pack.
        write(
            OUT / "data" / NS / "tags" / tag_block_dir / "passable.json",
            json.dumps({
                "values": [
                    "minecraft:air",
                    "minecraft:cave_air",
                    "minecraft:void_air",
                    {"id": "minecraft:water", "required": False},
                    {"id": "minecraft:short_grass", "required": False},
                    {"id": "minecraft:grass", "required": False},
                    {"id": "minecraft:tall_grass", "required": False},
                    {"id": "minecraft:fern", "required": False},
                    {"id": "minecraft:large_fern", "required": False},
                    {"id": "minecraft:snow", "required": False},
                ]
            }, indent=2),
        )

    write(OUT / "pack.mcmeta", json.dumps({
        "pack": {
            "pack_format": 48,
            "supported_formats": {"min_inclusive": 15, "max_inclusive": 99},
            "description": "Orbital Arsenal — cannon, nuke and kamehameha"
        }
    }, indent=2))

    archive = ROOT / "OrbitalArsenal-Java.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in sorted(OUT.rglob("*")):
            if file.is_file():
                zf.write(file, file.relative_to(OUT))

    lines = sum(len(b.splitlines()) for b in functions.values())
    print(f"functions: {len(functions)}  ({lines:,} command lines)")
    print(f"crater fills: {len(fills):,} across {NUKE_STAGES} stages "
          f"({per_stage} per tick)")
    print(f"wrote {archive} ({archive.stat().st_size:,} bytes)")


if __name__ == "__main__":
    build()
