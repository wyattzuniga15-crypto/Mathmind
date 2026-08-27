#!/usr/bin/env python3
"""Check the mod project before it goes anywhere near a build.

Written after shipping a version where every JSON file ended in a literal
backslash-n rather than a newline. All fourteen were invalid, and the only
symptom was one line buried in a Gradle failure — the sort of thing that costs
a round trip when the person building it isn't the person who broke it.

Also compiles the sources against the stubs in stubs/, which catches Java
mistakes without needing Minecraft to compile against.

Run: python3 verify.py
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).parent
RES = ROOT / "src/main/resources"
problems = []
checks = 0


def check(condition, message):
    global checks
    checks += 1
    if not condition:
        problems.append(message)


def main():
    lang_path = ROOT / "src/main/resources/assets/orbital/lang/en_us.json"
    global checks
    # --- every JSON parses, and has nothing trailing the closing brace ---
    for path in sorted(RES.rglob("*.json")):
        rel = path.relative_to(ROOT)
        raw = path.read_text()
        try:
            json.loads(raw)
            checks += 1
        except json.JSONDecodeError as exc:
            tail = repr(raw[-12:])
            problems.append(f"{rel}: invalid JSON — {exc} (ends {tail})")
            checks += 1

    # --- the mod metadata points at code that exists ---
    meta_path = RES / "fabric.mod.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text())
        except json.JSONDecodeError:
            meta = None
        if meta:
            for field in ("schemaVersion", "id", "version", "entrypoints"):
                check(field in meta, f"fabric.mod.json has no '{field}'")
            for entry in meta.get("entrypoints", {}).get("main", []):
                source = ROOT / "src/main/java" / (entry.replace(".", "/") + ".java")
                check(source.exists(),
                      f"entrypoint {entry} has no source file at {source.relative_to(ROOT)}")

    # --- every model's texture is actually on disk ---
    for path in sorted((RES / "assets/orbital/models/item").glob("*.json")):
        try:
            model = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        for layer in model.get("textures", {}).values():
            namespace, name = layer.split(":", 1)
            png = RES / "assets" / namespace / "textures" / (name + ".png")
            check(png.exists(), f"{path.name}: texture missing at {png.relative_to(ROOT)}")

    # --- every registered item has a name, a model and a texture ---
    items_java = (ROOT / "src/main/java/com/orbital/arsenal/ModItems.java").read_text()
    registered = set(re.findall(r'register\("([a-z_]+)"', items_java))
    check(len(registered) >= 6, f"expected at least 6 registered items, found {len(registered)}")
    lang_path = RES / "assets/orbital/lang/en_us.json"
    lang = {}
    if lang_path.exists():
        try:
            lang = json.loads(lang_path.read_text())
        except json.JSONDecodeError:
            pass
    for name in sorted(registered):
        check(f"item.orbital.{name}" in lang, f"{name} has no en_us.lang entry")
        check((RES / f"assets/orbital/models/item/{name}.json").exists(),
              f"{name} has no item model")
        check((RES / f"assets/orbital/textures/item/{name}.png").exists(),
              f"{name} has no texture")
        check((RES / f"assets/orbital/items/{name}.json").exists(),
              f"{name} has no 1.21.4+ item definition")

    # --- every recipe makes something this mod registers ---
    for path in sorted((RES / "data/orbital/recipe").glob("*.json")):
        try:
            recipe = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        result = recipe.get("result", {}).get("id", "")
        check(result.replace("orbital:", "") in registered,
              f"{path.name} makes '{result}', which is not registered")
        keys = set(recipe.get("key", {}))
        used = {c for row in recipe.get("pattern", []) for c in row if c != " "}
        check(used <= keys, f"{path.name} uses undefined keys: {sorted(used - keys)}")

    # --- the mixin config lines up with the code and the metadata ---
    #
    # A mixin that is declared but unreachable fails at game launch, not at
    # build time, so nothing else here would catch a wrong package or a class
    # listed under a name that does not exist.
    mixin_path = RES / "orbital.mixins.json"
    if mixin_path.exists():
        try:
            mixins = json.loads(mixin_path.read_text())
        except json.JSONDecodeError:
            mixins = None
        if mixins:
            package = mixins.get("package", "")
            check(bool(package), "orbital.mixins.json has no 'package'")
            for name in mixins.get("mixins", []):
                source = ROOT / "src/main/java" / (package + "." + name).replace(".", "/")
                check(source.with_suffix(".java").exists(),
                      f"mixin {name} has no source at {source.relative_to(ROOT)}.java")
            declared = json.loads((RES / "fabric.mod.json").read_text()).get("mixins", [])
            check("orbital.mixins.json" in declared,
                  "orbital.mixins.json exists but fabric.mod.json does not list it")

    # --- stubs may not re-declare members the real API has been proven to lack ---
    #
    # A stub is only as useful as it is honest. These two were declared on
    # Entity, compiled clean here, and then failed the real build — so the
    # compile check above passed on a lie. Anything a real build has rejected
    # goes in this list so it cannot come back.
    absent = {
        "net/minecraft/entity/Entity.java": ["velocityModified", "getPos"],
        "com/mojang/authlib/GameProfile.java": ["getName"],
    }
    for rel, members in absent.items():
        stub = ROOT / "stubs" / rel
        if not stub.exists():
            continue
        body = stub.read_text()
        for member in members:
            declared = re.search(rf"^\s*public\s+\S+\s+{member}\b", body, re.M)
            check(declared is None,
                  f"stubs/{rel} declares '{member}', which Yarn 1.21.11 does not have")

    # --- the journal's run-length encoding round-trips ---
    #
    # The subtlest logic in the mod: a run that extends when it should not, or
    # a replay that walks one from the wrong end, corrupts the world quietly.
    test = ROOT / "test_journal_runs.py"
    if test.exists():
        result = subprocess.run([sys.executable, str(test)], capture_output=True, text=True)
        checks += 1
        print(result.stdout.rstrip())
        if result.returncode != 0:
            problems.append("journal run-length round-trip failed")

    # --- no two items share a recipe ---
    #
    # Two shaped recipes with the same ingredients in the same arrangement do
    # not conflict loudly: one of them simply never appears, and the item it
    # belongs to becomes uncraftable with no error anywhere. Two pairs had
    # collided before anyone laid them side by side.
    shapes = {}
    recipe_dir = ROOT / "src/main/resources/data/orbital/recipe"
    if recipe_dir.exists():
        for recipe_file in sorted(recipe_dir.glob("*.json")):
            recipe = json.loads(recipe_file.read_text())
            if recipe.get("type") != "minecraft:crafting_shaped":
                continue
            key = {k: (v["item"] if isinstance(v, dict) else v)
                   for k, v in recipe.get("key", {}).items()}
            # The letters are arbitrary; the arrangement of ingredients is not.
            grid = tuple("".join(key.get(ch, " ") + "|" for ch in row.ljust(3)[:3])
                         for row in recipe["pattern"])
            check(grid not in shapes,
                  f"{recipe_file.stem} has the same recipe as {shapes.get(grid)} — "
                  f"one of the two will be uncraftable")
            shapes.setdefault(grid, recipe_file.stem)
        print(f"  {len(shapes)} recipes, all distinct")

    # --- every registered mob has a name ---
    #
    # A mob with no lang entry is not broken, which is why this went unnoticed:
    # it spawns, it fights, it renders. It just shows "entity.orbital.chronarch"
    # over its head instead of a name, and nothing anywhere complains.
    mod_entities = ROOT / "src/main/java/com/orbital/arsenal/entity/ModEntities.java"
    if mod_entities.exists() and lang_path.exists():
        names = json.loads(lang_path.read_text())
        for mob in sorted(set(re.findall(r'Identifier\.of\(OrbitalArsenal\.MOD_ID, "([a-z_0-9]+)"\)',
                                         mod_entities.read_text()))):
            check(f"entity.orbital.{mob}" in names,
                  f"entity {mob} has no name in en_us.json — it will show its id in game")
            texture = ROOT / f"src/main/resources/assets/orbital/textures/entity/{mob}.png"
            check(texture.exists(), f"entity {mob} has no texture at {texture.name}")
        print("  every registered mob has a name and a texture")

    # --- nothing holds a player object across ticks ---
    #
    # A PlayerEntity is replaced on every respawn and every dimension change,
    # and nothing removes it from a static map on disconnect. So a map keyed by
    # one loses its entry the moment the player dies, and holds the old entity
    # — and through it the whole world — for as long as the server runs. Seven
    # of these had accumulated before anyone looked. A UUID is stable across
    # both and holds nothing.
    holders = []
    for src in sorted((ROOT / "src/main/java").rglob("*.java")):
        for match in re.finditer(r"static\s+(?:final\s+)?(?:Map|Set|List)<\s*(?:Server)?PlayerEntity[,>]",
                                 src.read_text()):
            holders.append(f"{src.name}: {match.group(0).strip()}")
    check(not holders,
          "static collections keyed by a player entity leak it after "
          f"disconnect — key by UUID instead: {holders}")
    print("  no static collection holds a player entity")

    # --- the hundred items agree with each other ---
    #
    # The per-item checks below catch a missing file. They cannot catch an item
    # registered twice, a texture left behind by an item that was renamed, or a
    # class nothing registers — and with a hundred items, all three are the
    # failures that actually happen.
    lang_file = ROOT / "src/main/resources/assets/orbital/lang/en_us.json"
    mod_file = ROOT / "src/main/java/com/orbital/arsenal/ModItems.java"
    if lang_file.exists() and mod_file.exists():
        lang = json.loads(lang_file.read_text())
        ids = sorted(k.split(".")[-1] for k in lang if k.startswith("item.orbital."))
        mod = mod_file.read_text()
        registered = re.findall(r'register\("([a-z_0-9]+)"', mod)
        fields = re.findall(r"public static Item (\w+);", mod)
        added = re.findall(r"entries\.add\((\w+)\);", mod)

        for name, seen in (("registration", registered), ("field", fields),
                           ("creative-tab entry", added)):
            twice = sorted({v for v in seen if seen.count(v) > 1})
            check(not twice, f"duplicate {name}: {twice}")
        check(set(registered) == set(ids),
              "registered ids and lang entries disagree: "
              f"{sorted(set(registered) ^ set(ids))}")
        check(set(fields) == set(added),
              f"items never shown in the creative tab: {sorted(set(fields) - set(added))}")

        # Constructed by lambda as well as by reference: the rewind clocks take
        # arguments, so a ::new-only scan reports them as dead code.
        used = set(re.findall(r"(\w+Item)::new", mod)) | set(re.findall(r"new (\w+Item)\(", mod))
        on_disk = {p.stem for p in (ROOT / "src/main/java/com/orbital/arsenal/items").glob("*Item.java")}
        check(on_disk <= used, f"item classes nothing registers: {sorted(on_disk - used)}")

        # Files left behind by an item that was renamed or dropped.
        for folder, suffix in (("src/main/resources/assets/orbital/items", ".json"),
                               ("src/main/resources/assets/orbital/textures/item", ".png"),
                               ("src/main/resources/assets/orbital/models/item", ".json")):
            for stray in sorted((ROOT / folder).glob("*" + suffix)):
                check(stray.stem in ids, f"orphan file, no such item: {folder}/{stray.name}")

        print(f"  {len(ids)} items agree across registry, lang, models, textures and recipes")

    # --- sounds are used the way the real jar declares them ---
    #
    # Whether a SoundEvents constant is bare or a RegistryEntry.Reference is
    # not guessable and not consistent — BLOCK_NOTE_BLOCK_BASS is wrapped and
    # BLOCK_GLASS_BREAK beside it is not — and the stubs cannot settle it,
    # because the stubs are whatever I last assumed. So the answer is recorded
    # from a real build and checked here. A sound that is in neither list is
    # reported as unverified rather than failed: it is a guess, and the point
    # is knowing that before the push rather than after the build.
    table = ROOT / "known_sound_types.json"
    if table.exists():
        known = json.loads(table.read_text())
        bare = set(known.get("bare", []))
        wrapped = set(known.get("wrapped", []))
        used = {}
        for src in (ROOT / "src/main/java").rglob("*.java"):
            text = src.read_text()
            for name in re.findall(r"SoundEvents\.([A-Z_0-9]+)(\.value\(\))?", text):
                pass
            for match in re.finditer(r"SoundEvents\.([A-Z_0-9]+)(\.value\(\))?", text):
                used.setdefault(match.group(1), set()).add(bool(match.group(2)))
        unverified = []
        for name, forms in sorted(used.items()):
            if name in wrapped:
                check(forms == {True},
                      f"SoundEvents.{name} is a registry entry — it needs .value()")
            elif name in bare:
                check(forms == {False},
                      f"SoundEvents.{name} is a bare SoundEvent — drop the .value()")
            else:
                unverified.append(name)
        print(f"  {len(used) - len(unverified)} sounds match the types a real build reported")
        if unverified:
            print("  unverified sounds (a guess until CI reports on them): "
                  + ", ".join(unverified))

    # --- every companion tool reaches every provider ---
    #
    # The Anthropic SDK reads the annotations on the Tools classes itself,
    # while every other provider is served by the reflection registry in
    # Schemas. Nothing in the compiler ties those two together, so a tool added
    # to one and not the other simply goes missing for half the providers, in
    # silence. And a tool or field with no description is worse than absent —
    # the model sees it, cannot tell what it does, and calls it wrongly.
    tools_src = (ROOT / "src/main/java/com/orbital/arsenal/companion/Tools.java")
    schemas_src = (ROOT / "src/main/java/com/orbital/arsenal/companion/Schemas.java")
    if tools_src.exists() and schemas_src.exists():
        tools_text = tools_src.read_text()
        schemas_text = schemas_src.read_text()
        declared = re.findall(r"public static class (\w+) implements Supplier<String>", tools_text)
        registered = re.findall(r"add\(Tools\.(\w+)\.class\)", schemas_text)
        check(declared, "no companion tools found in Tools.java")
        for name in declared:
            check(name in registered,
                  f"Tools.{name} is not registered in Schemas — it would be invisible "
                  f"to every provider except Claude")
            check(re.search(r"@JsonClassDescription\s*\((?:.|\n)*?\)\s*\n\s*public static class "
                            + name + r"\b", tools_text),
                  f"Tools.{name} has no @JsonClassDescription — the model cannot tell "
                  f"what it is for")
            body = re.search(r"public static class " + name
                             + r" implements Supplier<String> \{(.*?)\n    \}\n",
                             tools_text, re.S)
            if body:
                for field in re.finditer(
                        r"(@JsonPropertyDescription\s*\((?:[^()]|\([^()]*\))*\)\s*)?"
                        r"public (?!static)(\w[\w<>\[\]]*) (\w+) =", body.group(1)):
                    check(field.group(1),
                          f"Tools.{name}.{field.group(3)} has no @JsonPropertyDescription")
        for name in registered:
            check(name in declared,
                  f"Schemas registers Tools.{name}, which does not exist")
        print(f"  {len(declared)} companion tools reach every provider")

    # --- no area effect hands another player to discard() ---
    #
    # Area.living returns every entity in reach except the one you name, and
    # on a server that includes the other players. discard() on a
    # ServerPlayerEntity removes them from the world without telling their
    # client: they do not die, they desync. Anything that removes what it
    # catches has to draw from Area.mobs instead.
    for src in sorted((ROOT / "src/main/java/com/orbital/arsenal/items").glob("*.java")):
        text = src.read_text()
        if ".discard()" in text:
            check("Area.living(" not in text,
                  f"{src.name} calls discard() on entities from Area.living — "
                  f"that would remove other players from the world; use Area.mobs")

    # --- the per-tick write guard is still wired up ---
    #
    # A counter that is never incremented never warns, and one that is never
    # reset warns forever and then gets ignored. Both fail silently, which is
    # the failure mode this guard exists to catch in the first place.
    journal_src = ROOT / "src/main/java/com/orbital/arsenal/time/Journal.java"
    if journal_src.exists():
        text = journal_src.read_text()
        body = re.search(r"public static void record\(.*?\n    \}", text, re.S)
        check(body and "++writtenThisTick" in body.group(0),
              "Journal.record no longer counts writes — the per-tick budget warning "
              "can never fire")
        body = re.search(r"public static void tick\(\).*?\n    \}", text, re.S)
        check(body and "writtenThisTick = 0" in body.group(0) and "warnedThisTick = false" in body.group(0),
              "Journal.tick no longer resets the per-tick write counter — the warning "
              "would fire once and never again")
        print("  the per-tick write budget counts and resets")

    # --- the Java itself compiles against the stubs ---
    sources = list((ROOT / "src/main/java").rglob("*.java")) + list((ROOT / "stubs").rglob("*.java"))
    with tempfile.TemporaryDirectory() as out:
        result = subprocess.run(
            ["javac", "-nowarn", "-d", out] + [str(s) for s in sources],
            capture_output=True, text=True,
        )
        checks += 1
        if result.returncode != 0:
            errors = [ln for ln in result.stderr.splitlines() if "error:" in ln]
            problems.append("Java does not compile against the stubs:")
            problems.extend("    " + e for e in errors[:8])

    report(len(sources))


def report(source_count=0):
    if problems:
        print(f"FAILED — {len(problems)} problem(s) across {checks} checks:")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    print(f"OK — {checks} checks passed ({source_count} java files compile)")


if __name__ == "__main__":
    if shutil.which("javac") is None:
        print("javac not found — install a JDK to run the compile check")
        sys.exit(1)
    main()
