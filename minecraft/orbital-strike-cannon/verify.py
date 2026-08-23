#!/usr/bin/env python3
"""Cross-check the add-on for the mistakes that stop a pack activating.

Minecraft reports these as a pack that silently refuses to turn on, so catch
them here instead: JSON that doesn't parse, identifiers that don't line up
between the behavior and resource packs, references to files that aren't
there, and manifest UUID/dependency problems.

Run: python3 verify.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
problems = []
checks = 0


def check(condition, message):
    global checks
    checks += 1
    if not condition:
        problems.append(message)


def load(rel):
    path = ROOT / rel
    if not path.exists():
        problems.append(f"missing file: {rel}")
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        problems.append(f"{rel}: invalid JSON — {exc}")
        return None


def main():
    # --- every JSON file parses ---
    for path in sorted(ROOT.rglob("*.json")):
        if "__pycache__" in path.parts:
            continue
        load(path.relative_to(ROOT))

    bp = load("BP/manifest.json")
    rp = load("RP/manifest.json")
    if not bp or not rp:
        report()
        return

    # --- manifests ---
    ids = [bp["header"]["uuid"]] + [m["uuid"] for m in bp["modules"]]
    ids += [rp["header"]["uuid"]] + [m["uuid"] for m in rp["modules"]]
    check(len(ids) == len(set(ids)), "duplicate UUID inside the pack")
    dep = next((d for d in bp.get("dependencies", []) if "uuid" in d), None)
    check(dep is not None, "BP declares no dependency on the RP")
    if dep:
        check(dep["uuid"] == rp["header"]["uuid"],
              "BP dependency UUID does not match the RP header UUID")
        check(dep["version"] == rp["header"]["version"],
              f"BP wants RP {dep['version']} but the RP is {rp['header']['version']}"
              " — the BP will refuse to activate")
    script_mod = next((m for m in bp["modules"] if m["type"] == "script"), None)
    check(script_mod is not None, "BP has no script module")
    if script_mod:
        check((ROOT / "BP" / script_mod["entry"]).exists(),
              f"script entry missing: BP/{script_mod['entry']}")

    # --- item ---
    item = load("BP/items/orbital_strike_cannon.item.json")
    item_id = item["minecraft:item"]["description"]["identifier"] if item else None
    icon = item["minecraft:item"]["components"]["minecraft:icon"] if item else None
    atlas = load("RP/textures/item_texture.json")
    if icon and atlas:
        check(icon in atlas["texture_data"],
              f"item icon '{icon}' is not in item_texture.json")
        rel = atlas["texture_data"].get(icon, {}).get("textures", "")
        check((ROOT / "RP" / (rel + ".png")).exists(),
              f"item texture missing: RP/{rel}.png")

    # --- recipe points at the real item ---
    recipe = load("BP/recipes/orbital_strike_cannon.recipe.json")
    if recipe and item_id:
        result = recipe["minecraft:recipe_shaped"]["result"]["item"]
        check(result == item_id,
              f"recipe makes '{result}' but the item is '{item_id}'")

    # --- shell entity, behavior side ---
    ent = load("BP/entities/sky_tnt.behavior.json")
    ent_id = groups = events = None
    if ent:
        body = ent["minecraft:entity"]
        ent_id = body["description"]["identifier"]
        groups = set(body.get("component_groups", {}))
        events = set(body.get("events", {}))
        check(body["description"].get("is_summonable") is True,
              "shell entity is not summonable — spawnEntity will fail")
        for name, event in body.get("events", {}).items():
            for group in [event.get("add", {}).get("component_group")]:
                if group:
                    check(group in groups,
                          f"event '{name}' adds unknown component group '{group}'")

    # --- shell entity, resource side ---
    client = load("RP/entity/sky_tnt.entity.json")
    if client and ent_id:
        desc = client["minecraft:client_entity"]["description"]
        check(desc["identifier"] == ent_id,
              f"RP entity '{desc['identifier']}' does not match BP entity '{ent_id}'")
        for rel in desc["textures"].values():
            check((ROOT / "RP" / (rel + ".png")).exists(),
                  f"entity texture missing: RP/{rel}.png")
        geo = load("RP/models/entity/sky_tnt.geo.json")
        if geo:
            have = {g["description"]["identifier"] for g in geo["minecraft:geometry"]}
            for want in desc["geometry"].values():
                check(want in have, f"geometry '{want}' is not defined")
        rc = load("RP/render_controllers/sky_tnt.render_controllers.json")
        if rc:
            have = set(rc["render_controllers"])
            for want in desc["render_controllers"]:
                check(want in have, f"render controller '{want}' is not defined")

    # --- script lines up with the JSON it drives ---
    script = (ROOT / "BP/scripts/main.js").read_text()
    def const(name):
        m = re.search(rf'const {name} = "([^"]+)"', script)
        return m.group(1) if m else None
    check(const("CANNON_ID") == item_id,
          f"script fires on '{const('CANNON_ID')}' but the item is '{item_id}'")
    check(const("SHELL_ID") == ent_id,
          f"script spawns '{const('SHELL_ID')}' but the entity is '{ent_id}'")
    for used in set(re.findall(r'triggerEvent\("([^"]+)"\)', script)):
        check(events is not None and used in events,
              f"script triggers '{used}', which the entity does not define")

    # Anything at the top level of main.js runs while the module loads, and a
    # throw there fails the script module — which Minecraft surfaces only as a
    # pack that won't activate, and a world that won't create. So top-level
    # calls are held to APIs proven to exist on the runtimes this targets.
    PROVEN_TOP_LEVEL = {
        "system.runInterval",
        "system.runTimeout",
        "world.afterEvents.itemUse.subscribe",
    }
    for line in script.splitlines():
        if not re.match(r"^(world|system)\.", line):
            continue
        call = re.match(r"^([A-Za-z0-9_.]+)\(", line)
        if call:
            check(call.group(1) in PROVEN_TOP_LEVEL,
                  f"unproven API '{call.group(1)}' called at the top level of "
                  "main.js — if it doesn't exist the pack won't activate. Move "
                  "it inside a handler, or add it to PROVEN_TOP_LEVEL once "
                  "confirmed working in game.")

    report()


def report():
    if problems:
        print(f"FAILED — {len(problems)} problem(s) across {checks} checks:")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    print(f"OK — {checks} checks passed, pack is internally consistent")


if __name__ == "__main__":
    main()
