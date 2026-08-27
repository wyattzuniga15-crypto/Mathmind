#!/usr/bin/env python3
"""Check the generated datapack for the mistakes Minecraft reports badly.

A datapack with a bad function reference or an oversized fill loads without
complaint and then simply does nothing when fired, which is the same silent
failure that cost so many rounds on the Bedrock side. Catch it here instead.

Run: python3 verify_datapack.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
BUILD = ROOT / "build"
FILL_LIMIT = 32768  # blocks per /fill in Java

problems = []
checks = 0


def check(condition, message):
    global checks
    checks += 1
    if not condition:
        problems.append(message)


def main():
    global checks
    check(BUILD.exists(), "no build/ — run build_datapack.py first")
    if not BUILD.exists():
        report()
        return

    # --- every JSON parses ---
    for path in sorted(BUILD.rglob("*.json")):
        try:
            json.loads(path.read_text())
        except json.JSONDecodeError as exc:
            problems.append(f"{path.relative_to(BUILD)}: invalid JSON — {exc}")
        checks += 1

    meta = json.loads((BUILD / "pack.mcmeta").read_text())
    check("pack_format" in meta["pack"], "pack.mcmeta has no pack_format")

    # --- both folder layouts present, so one zip spans the 1.21 rename ---
    for folder in ("function", "functions"):
        check((BUILD / "data" / "orbital" / folder).is_dir(),
              f"missing data/orbital/{folder} — the pack won't load on one side "
              "of the 1.21 folder rename")
    for folder in ("block", "blocks"):
        check((BUILD / "data" / "orbital" / "tags" / folder / "passable.json").exists(),
              f"missing block tag under tags/{folder}")

    # --- collect every function that exists, and every one referenced ---
    have = set()
    for path in (BUILD / "data" / "orbital" / "function").rglob("*.mcfunction"):
        have.add("orbital:" + str(
            path.relative_to(BUILD / "data" / "orbital" / "function")
        ).replace("\\", "/")[:-len(".mcfunction")])

    referenced = set()
    for path in sorted((BUILD / "data" / "orbital" / "function").rglob("*.mcfunction")):
        text = path.read_text()
        referenced |= set(re.findall(r"\bfunction\s+([a-z0-9_.-]+:[a-z0-9_./-]+)", text))
    for tag in ("load", "tick"):
        data = json.loads(
            (BUILD / "data" / "minecraft" / "tags" / "function" / f"{tag}.json").read_text()
        )
        referenced |= set(data["values"])

    for name in sorted(referenced):
        check(name in have, f"function '{name}' is referenced but does not exist")
    check(len(have) > 0, "no functions were generated")

    # --- no fill may exceed Java's per-command block ceiling ---
    biggest = 0
    fills = 0
    for path in sorted((BUILD / "data" / "orbital" / "function").rglob("*.mcfunction")):
        for line_no, line in enumerate(path.read_text().splitlines(), 1):
            line = line.strip()
            if not line.startswith("fill "):
                continue
            fills += 1
            coords = re.findall(r"~(-?\d+)", line)
            if len(coords) != 6:
                problems.append(f"{path.name}:{line_no}: fill without six coords: {line}")
                checks += 1
                continue
            x1, y1, z1, x2, y2, z2 = (int(c) for c in coords)
            volume = (abs(x2 - x1) + 1) * (abs(y2 - y1) + 1) * (abs(z2 - z1) + 1)
            biggest = max(biggest, volume)
            if volume > FILL_LIMIT:
                problems.append(
                    f"{path.name}:{line_no}: fill covers {volume:,} blocks, "
                    f"over the {FILL_LIMIT:,} limit — the command is rejected"
                )
            checks += 1

    # --- scoreboard objectives are created before they're used ---
    load = (BUILD / "data" / "orbital" / "function" / "load.mcfunction").read_text()
    declared = set(re.findall(r"scoreboard objectives add (\S+)", load))
    used = set()
    for path in sorted((BUILD / "data" / "orbital" / "function").rglob("*.mcfunction")):
        text = path.read_text()
        used |= set(re.findall(r"scoreboard players \w+ \S+ (\S+)", text))
        used |= set(re.findall(r"score @?\S+ (orbital\.\w+)", text))
        used |= set(re.findall(r"scores=\{(\w+\.\w+)=", text))
    for objective in sorted(o for o in used if o.startswith("orbital.")):
        check(objective in declared,
              f"objective '{objective}' is used but never created in load")

    print(f"functions: {len(have)}  fills: {fills:,}  largest fill: {biggest:,} blocks")
    report()


def report():
    if problems:
        print(f"FAILED — {len(problems)} problem(s) across {checks} checks:")
        for p in problems[:20]:
            print(f"  - {p}")
        if len(problems) > 20:
            print(f"  ... and {len(problems) - 20} more")
        sys.exit(1)
    print(f"OK — {checks:,} checks passed, datapack is internally consistent")


if __name__ == "__main__":
    main()
