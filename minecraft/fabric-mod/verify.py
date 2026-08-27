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
