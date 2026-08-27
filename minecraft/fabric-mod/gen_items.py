#!/usr/bin/env python3
"""Emit simple item classes from a table.

Same reasoning as gen_sculptures: the frame around an item — the class, the
server-world guard, the cooldown, the aim — is identical every time, and typing
it out is only a chance to get one of them wrong. What differs is the body, and
the body is what the table holds.
"""
import json
import sys
from pathlib import Path

OUT = Path(__file__).parent / "src/main/java/com/orbital/arsenal/items"

TEMPLATE = '''package com.orbital.arsenal.items;

{imports}

/** {doc} */
public class {cls}Item extends Item {{
{fields}
    public {cls}Item(Settings settings) {{
        super(settings);
    }}

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {{
        if (!(world instanceof ServerWorld serverWorld)) {{
            return ActionResult.SUCCESS;
        }}
{body}
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }}
{extra}}}
'''

BASE_IMPORTS = [
    "import net.minecraft.entity.player.PlayerEntity;",
    "import net.minecraft.item.Item;",
    "import net.minecraft.server.world.ServerWorld;",
    "import net.minecraft.text.Text;",
    "import net.minecraft.util.ActionResult;",
    "import net.minecraft.util.Hand;",
    "import net.minecraft.world.World;",
]

def emit(spec):
    imports = sorted(set(BASE_IMPORTS + spec.get("imports", [])))
    body = "\n".join("        " + l for l in spec["body"])
    fields = "\n".join("    " + l for l in spec.get("fields", [])) + "\n" if spec.get("fields") else ""
    extra = "\n" + "\n".join("    " + l for l in spec["extra"]) + "\n" if spec.get("extra") else ""
    text = TEMPLATE.format(cls=spec["cls"], doc=spec["doc"], imports="\n".join(imports),
                           body=body, fields=fields, extra=extra)
    (OUT / f"{spec['cls']}Item.java").write_text(text)

if __name__ == "__main__":
    specs = json.loads(Path(sys.argv[1]).read_text())
    for spec in specs:
        emit(spec)
    print(f"wrote {len(specs)} item classes")
