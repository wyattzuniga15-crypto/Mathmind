#!/usr/bin/env python3
"""Package the behavior + resource packs into OrbitalStrikeCannon.mcaddon.

Run: python3 build.py
The .mcaddon is just a zip holding the BP/ and RP/ folders — Minecraft
Bedrock imports it directly when you open the file.
"""
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "OrbitalStrikeCannon.mcaddon"


def main() -> None:
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in ("BP", "RP"):
            for file in sorted((ROOT / pack).rglob("*")):
                if file.is_file():
                    zf.write(file, file.relative_to(ROOT))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
