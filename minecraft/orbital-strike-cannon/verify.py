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

    # --- every item: icon is in the atlas, and the texture is on disk ---
    atlas = load("RP/textures/item_texture.json")
    lang = (ROOT / "RP/texts/en_US.lang").read_text()
    item_ids = set()
    for path in sorted((ROOT / "BP/items").glob("*.json")):
        item = load(path.relative_to(ROOT))
        if not item:
            continue
        body = item["minecraft:item"]
        item_id = body["description"]["identifier"]
        item_ids.add(item_id)
        icon = body["components"].get("minecraft:icon")
        check(icon is not None, f"{item_id} has no icon component")
        if icon and atlas:
            check(icon in atlas["texture_data"],
                  f"item icon '{icon}' is not in item_texture.json")
            rel = atlas["texture_data"].get(icon, {}).get("textures", "")
            check((ROOT / "RP" / (rel + ".png")).exists(),
                  f"item texture missing: RP/{rel}.png")
        check(f"item.{item_id}.name=" in lang,
              f"{item_id} has no en_US.lang entry")

    # --- every recipe makes an item that exists ---
    for path in sorted((ROOT / "BP/recipes").glob("*.json")):
        recipe = load(path.relative_to(ROOT))
        if not recipe:
            continue
        shaped = recipe.get("minecraft:recipe_shaped", {})
        result = shaped.get("result", {}).get("item")
        check(result in item_ids,
              f"{path.name} makes '{result}', which is not an item in this pack")
        # Every key in the pattern must be defined, or the recipe silently fails.
        keys = set(shaped.get("key", {}))
        used = {c for row in shaped.get("pattern", []) for c in row if c != " "}
        check(used <= keys,
              f"{path.name} uses undefined pattern keys: {sorted(used - keys)}")

    # --- every entity: behavior side lines up with resource side ---
    entity_ids = set()
    events_by_id = {}
    for path in sorted((ROOT / "BP/entities").glob("*.json")):
        ent = load(path.relative_to(ROOT))
        if not ent:
            continue
        body = ent["minecraft:entity"]
        ent_id = body["description"]["identifier"]
        entity_ids.add(ent_id)
        groups = set(body.get("component_groups", {}))
        events_by_id[ent_id] = set(body.get("events", {}))
        check(body["description"].get("is_summonable") is True,
              f"{ent_id} is not summonable — spawnEntity will fail")
        for name, event in body.get("events", {}).items():
            group = event.get("add", {}).get("component_group")
            if group:
                check(group in groups,
                      f"{ent_id} event '{name}' adds unknown group '{group}'")
        check(f"entity.{ent_id}.name=" in lang,
              f"{ent_id} has no en_US.lang entry")

        # The matching client entity, found by identifier rather than filename.
        client = None
        for candidate in sorted((ROOT / "RP/entity").glob("*.json")):
            data = load(candidate.relative_to(ROOT))
            if data and data["minecraft:client_entity"]["description"]["identifier"] == ent_id:
                client = data
                break
        check(client is not None,
              f"{ent_id} has no client entity in RP/entity — it would be invisible")
        if not client:
            continue
        desc = client["minecraft:client_entity"]["description"]
        for rel in desc["textures"].values():
            check((ROOT / "RP" / (rel + ".png")).exists(),
                  f"{ent_id} texture missing: RP/{rel}.png")
        # Geometry and render controllers must be defined somewhere in the RP.
        geometries = set()
        for geo_file in sorted((ROOT / "RP/models/entity").glob("*.json")):
            geo = load(geo_file.relative_to(ROOT))
            if geo:
                geometries |= {g["description"]["identifier"]
                               for g in geo["minecraft:geometry"]}
        for want in desc["geometry"].values():
            check(want in geometries, f"{ent_id}: geometry '{want}' is not defined")
        controllers = set()
        for rc_file in sorted((ROOT / "RP/render_controllers").glob("*.json")):
            rc = load(rc_file.relative_to(ROOT))
            if rc:
                controllers |= set(rc["render_controllers"])
        for want in desc["render_controllers"]:
            check(want in controllers,
                  f"{ent_id}: render controller '{want}' is not defined")

    # --- script lines up with the JSON it drives ---
    script = (ROOT / "BP/scripts/main.js").read_text()
    def const(name):
        m = re.search(rf'const {name} = "([^"]+)"', script)
        return m.group(1) if m else None
    for name in ("CANNON_ID", "NUKE_ID", "KAME_ID"):
        check(const(name) in item_ids,
              f"script's {name} is '{const(name)}', which is not an item in this pack")
    for name in ("SHELL_ID", "KI_ID"):
        check(const(name) in entity_ids,
              f"script spawns '{const(name)}', which is not an entity in this pack")
    all_events = set().union(*events_by_id.values()) if events_by_id else set()
    for used in set(re.findall(r'triggerEvent\("([^"]+)"\)', script)):
        check(used in all_events,
              f"script triggers '{used}', which no entity defines")

    # Only one explosion configuration has ever been confirmed working in game.
    # breaksBlocks:false shipped once and produced no visible blast at all,
    # which is invisible from here because every call is wrapped.
    check("breaksBlocks: false" not in script,
          "main.js uses breaksBlocks:false, which shipped once and rendered "
          "nothing — use breaksBlocks:true (in mid-air it breaks nothing anyway)")

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
