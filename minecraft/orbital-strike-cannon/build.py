#!/usr/bin/env python3
"""Verify, then package the packs into OrbitalStrikeCannon.mcaddon.

Run: python3 build.py
The .mcaddon is just a zip holding the BP/ and RP/ folders — Minecraft
Bedrock imports it directly when you open the file.
"""
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "OrbitalStrikeCannon.mcaddon"


def main() -> None:
    # Never package a pack that won't activate — verify.py catches the broken
    # identifiers and manifest mistakes that Minecraft reports only as a pack
    # that silently refuses to turn on.
    result = subprocess.run([sys.executable, str(ROOT / "verify.py")])
    if result.returncode != 0:
        sys.exit("build aborted: verify.py failed")

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in ("BP", "RP"):
            for file in sorted((ROOT / pack).rglob("*")):
                if file.is_file():
                    zf.write(file, file.relative_to(ROOT))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
