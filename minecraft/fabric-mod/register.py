#!/usr/bin/env python3
"""Wire new items into the mod: registry, model, item definition, recipe, lang.

Five files have to agree for one item to exist, and verify.py checks all five —
so every item added by hand was five chances to be told off. This does the same
five every time, which is both faster and the reason none of them drift.

Usage: register.py <json file with a list of {id, field, cls, label, recipe}>
"""
import collections
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent
NEW = json.loads(Path(sys.argv[1]).read_text())

mod = ROOT / "src/main/java/com/orbital/arsenal/ModItems.java"
s = mod.read_text()

# Anchor on structure, not on the last field mentioned. The first version
# looked for the line starting "<LAST_FIELD> = register(" and inserted after
# it — which split a registration whose arguments run onto a second line, and
# produced Java that did not parse. Inserting immediately before the item-group
# block is always after every registration, however each one is written.
GROUP = "\n        ItemGroupEvents.modifyEntriesEvent("
assert s.count(GROUP) == 1, "cannot find the item group block to insert before"
last_field = s.rsplit("        entries.add(", 1)[1].split(")", 1)[0]

s = s.replace("import com.orbital.arsenal.items.CatBazookaItem;",
    "import com.orbital.arsenal.items.CatBazookaItem;\n" +
    "\n".join(f"import com.orbital.arsenal.items.{n['cls']};" for n in NEW), 1)
s = s.replace(f"    public static Item {last_field};",
    f"    public static Item {last_field};\n" +
    "\n".join(f"    public static Item {n['field']};" for n in NEW), 1)
s = s.replace(GROUP,
    "\n" + "\n".join(f'        {n["field"]} = register("{n["id"]}", {n["cls"]}::new);' for n in NEW)
    + GROUP, 1)
s = s.replace(f"            entries.add({last_field});",
    f"            entries.add({last_field});\n" +
    "\n".join(f"            entries.add({n['field']});" for n in NEW), 1)
mod.write_text(s)

for n in NEW:
    i = n["id"]
    json.dump({"model": {"type": "minecraft:model", "model": f"orbital:item/{i}"}},
              open(ROOT / f"src/main/resources/assets/orbital/items/{i}.json", "w"), indent=2)
    json.dump({"parent": "minecraft:item/generated",
               "textures": {"layer0": f"orbital:item/{i}"}},
              open(ROOT / f"src/main/resources/assets/orbital/models/item/{i}.json", "w"), indent=2)
    rows, key = n["recipe"]
    body = {"type": "minecraft:crafting_shaped", "category": "misc", "pattern": rows,
            "key": {k: {"item": v} for k, v in key.items()},
            "result": {"id": f"orbital:{i}", "count": 1}}
    for d in ("recipe", "recipes"):
        json.dump(body, open(ROOT / f"src/main/resources/data/orbital/{d}/{i}.json", "w"), indent=2)

lang = ROOT / "src/main/resources/assets/orbital/lang/en_us.json"
d = json.loads(lang.read_text(), object_pairs_hook=collections.OrderedDict)
for n in NEW:
    d[f"item.orbital.{n['id']}"] = n["label"]
lang.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")

print(f"registered {len(NEW)} items")
