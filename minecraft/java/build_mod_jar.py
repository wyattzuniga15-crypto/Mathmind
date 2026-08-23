#!/usr/bin/env python3
"""Package the datapack as a mod jar for the mods/ folder.

Fabric, Quilt, Forge and NeoForge all load `data/` straight out of a mod jar as
a built-in datapack, so a jar needs no compiled classes — only the metadata
each loader looks for. That makes this a genuine mods/ folder drop-in without
compiling against Minecraft, which matters because this machine can reach
neither Mojang's nor Fabric's maven repositories.

All four loaders' metadata files ship in one jar. Each loader reads its own and
ignores the rest, so a single file works whichever one is installed.

Run: python3 build_datapack.py && python3 build_mod_jar.py
"""
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent
BUILD = ROOT / "build"
MOD_ID = "orbital_arsenal"
VERSION = "1.0.0"
NAME = "Orbital Arsenal"
DESCRIPTION = (
    "Orbital strike cannon, tactical nuke and kamehameha. "
    "Right-click a carrot on a stick, a warped fungus on a stick or a goat horn."
)

FABRIC_MOD_JSON = {
    "schemaVersion": 1,
    "id": MOD_ID,
    "version": VERSION,
    "name": NAME,
    "description": DESCRIPTION,
    "license": "MIT",
    # No entrypoints: Fabric treats this as a resource-only mod and loads the
    # bundled datapack itself. Declaring one would demand compiled classes.
    "environment": "*",
}

QUILT_MOD_JSON = {
    "schema_version": 1,
    "quilt_loader": {
        "group": "com.orbital",
        "id": MOD_ID,
        "version": VERSION,
        "metadata": {
            "name": NAME,
            "description": DESCRIPTION,
            "license": "MIT",
        },
        "intermediate_mappings": "net.fabricmc:intermediary",
    },
}

# `lowcodefml` is Forge's loader for mods that are only data and resources —
# exactly this case. Anything else would expect classes to load.
FORGE_MODS_TOML = f"""\
modLoader="lowcodefml"
loaderVersion="[1,)"
license="MIT"

[[mods]]
modId="{MOD_ID}"
version="{VERSION}"
displayName="{NAME}"
description='''
{DESCRIPTION}
'''
"""

MANIFEST = f"""\
Manifest-Version: 1.0
Implementation-Title: {NAME}
Implementation-Version: {VERSION}
"""


def main():
    if not BUILD.exists():
        raise SystemExit("no build/ — run build_datapack.py first")

    jar = ROOT / f"OrbitalArsenal-{VERSION}.jar"
    with zipfile.ZipFile(jar, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("META-INF/MANIFEST.MF", MANIFEST)
        zf.writestr("fabric.mod.json", json.dumps(FABRIC_MOD_JSON, indent=2))
        zf.writestr("quilt.mod.json", json.dumps(QUILT_MOD_JSON, indent=2))
        zf.writestr("META-INF/mods.toml", FORGE_MODS_TOML)
        # NeoForge renamed the file in 1.20.5 but kept the format.
        zf.writestr("META-INF/neoforge.mods.toml", FORGE_MODS_TOML)
        # The datapack itself, pack.mcmeta and all, at the jar root.
        for file in sorted(BUILD.rglob("*")):
            if file.is_file():
                zf.write(file, file.relative_to(BUILD))

    with zipfile.ZipFile(jar) as zf:
        names = set(zf.namelist())
        required = {
            "fabric.mod.json": "Fabric",
            "quilt.mod.json": "Quilt",
            "META-INF/mods.toml": "Forge",
            "META-INF/neoforge.mods.toml": "NeoForge",
            "pack.mcmeta": "datapack root",
        }
        for path, who in required.items():
            assert path in names, f"missing {path} — {who} would reject this jar"
        functions = [n for n in names if n.endswith(".mcfunction")]
        assert functions, "no functions in the jar"
        json.loads(zf.read("fabric.mod.json"))
        json.loads(zf.read("pack.mcmeta"))

    print(f"wrote {jar.name} ({jar.stat().st_size:,} bytes)")
    print(f"  loaders: Fabric, Quilt, Forge, NeoForge")
    print(f"  {len(functions)} functions, {len(names)} entries")


if __name__ == "__main__":
    main()
