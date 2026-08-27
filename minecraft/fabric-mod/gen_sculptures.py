#!/usr/bin/env python3
"""Emit the sculpture item classes from one table.

Twelve near-identical files differing only in a shape function and an impact
is exactly the kind of thing that drifts when it is typed out twelve times —
one stray radius, one forgotten cooldown. Generating them keeps the frame
identical by construction and leaves the shape as the only thing to review.
"""
from pathlib import Path

OUT = Path("src/main/java/com/orbital/arsenal/items")

TEMPLATE = '''package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Sculpture;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** {doc} */
public class {cls}Item extends Item {{
    private static final int REACH = {reach};
    private static final int HEIGHT = {height};
    private static final int CRATER = {crater};
    private static final int DEPTH = {depth};
    private static final int COOLDOWN = 200;

    public {cls}Item(Settings settings) {{
        super(settings);
    }}

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {{
        if (!(world instanceof ServerWorld serverWorld)) {{
            return ActionResult.SUCCESS;
        }}
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, {cls}Item::paint, REACH, HEIGHT,
                "{shout}", (w, u, at) -> {{
                    Sculpture.boom(w, at, {power}F, 220);
                    w.spawnParticles(ParticleTypes.{spark}, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                }});
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }}

    private static Block paint(int x, int y, int z) {{
{shape}
        return null;
    }}
}}
'''

def L(*lines):
    return "\n".join("        " + l for l in lines)

SCULPTURES = [
 dict(cls="GiantChicken", doc="Drops an enormous chicken. It does not survive the landing.",
      reach=12, height=85, crater=24, depth=8, power="7.0", spark="HAPPY_VILLAGER",
      shout="GIANT CHICKEN", shape=L(
  "if (Sculpture.blob(x, y, z, 0, 0, 0, 6, 5, 4)) {",
  "    return Blocks.WHITE_CONCRETE;",
  "}",
  "if (Sculpture.ball(x, y, z, 5, 6, 0, 3.0)) {",
  "    // Eyes before the head, or the white would swallow them.",
  "    if (Sculpture.ball(x, y, z, 7.4, 6.8, 1.3, 0.7)",
  "            || Sculpture.ball(x, y, z, 7.4, 6.8, -1.3, 0.7)) {",
  "        return Blocks.BLACK_CONCRETE;",
  "    }",
  "    return Blocks.WHITE_CONCRETE;",
  "}",
  "if (Sculpture.blob(x, y, z, 8.4, 5.4, 0, 2.0, 1.0, 1.2)) {",
  "    return Blocks.ORANGE_CONCRETE;",
  "}",
  "if (Sculpture.ball(x, y, z, 4.6, 9.2, 0, 1.6)) {",
  "    return Blocks.RED_CONCRETE;",
  "}",
  "for (int lz = -1; lz <= 1; lz += 2) {",
  "    if (Math.abs(x - 1) <= 1 && Math.abs(z - lz * 2) <= 1 && y >= -9 && y < -5) {",
  "        return Blocks.ORANGE_CONCRETE;",
  "    }",
  "}",
  "if (Sculpture.blob(x, y, z, -6.5, 2, 0, 2.5, 3.0, 1.2)) {",
  "    return Blocks.WHITE_CONCRETE;",
  "}")),

 dict(cls="GiantBoot", doc="A colossal boot, which lands the way a boot lands.",
      reach=14, height=95, crater=22, depth=14, power="9.0", spark="LARGE_SMOKE",
      shout="THE BOOT", shape=L(
  "// The leg tapers and the toe is rounded off; a plain box reads as a box.",
  "double taper = 5.0 - Math.max(0, y) * 0.06;",
  "if (y >= -2 && y <= 12 && Math.abs(x) <= taper && Math.abs(z) <= taper) {",
  "    return Blocks.BLACK_CONCRETE;",
  "}",
  "if (y >= -8 && y < -2 && z >= -5 && z <= 5) {",
  "    // Ankle back to a rounded toe at the front.",
  "    double toe = x > 4 ? Math.sqrt(Math.max(0.0, 36.0 - (x - 4) * (x - 4))) : 6.0;",
  "    if (x >= -5 && x <= 10 && Math.abs(z) <= Math.min(5.0, toe)) {",
  "        return Blocks.BLACK_CONCRETE;",
  "    }",
  "}",
  "if (y >= -11 && y < -8 && x >= -6 && x <= 11 && Math.abs(z) <= 5) {",
  "    return Blocks.BROWN_CONCRETE;",
  "}")),

 dict(cls="GiantHammer", doc="A war hammer the size of a house, head first.",
      reach=16, height=100, crater=24, depth=20, power="11.0", spark="LARGE_SMOKE",
      shout="THE HAMMER", shape=L(
  "if (Sculpture.slab(x, y, z, -8, 8, 6, 14, -6, 6)) {",
  "    return Blocks.IRON_BLOCK;",
  "}",
  "if (Sculpture.post(x, z, 0, 0, 2.2) && y >= -14 && y < 6) {",
  "    return Blocks.OAK_LOG;",
  "}")),

 dict(cls="GiantSkull", doc="A skull ten blocks across, grinning.",
      reach=10, height=80, crater=18, depth=9, power="8.0", spark="SOUL_FIRE_FLAME",
      shout="THE SKULL", shape=L(
  "if (Sculpture.ball(x, y, z, 0, 4, 0, 7.5)) {",
  "    // Sockets and nose are holes, so they are checked first and return",
  "    // null — a darker block would still read as a solid face.",
  "    if (Sculpture.ball(x, y, z, 5.2, 5.4, 2.8, 2.2)",
  "            || Sculpture.ball(x, y, z, 5.2, 5.4, -2.8, 2.2)) {",
  "        return null;",
  "    }",
  "    if (Sculpture.ball(x, y, z, 6.6, 2.0, 0, 1.4)) {",
  "        return null;",
  "    }",
  "    return Blocks.BONE_BLOCK;",
  "}",
  "if (Sculpture.slab(x, y, z, -3, 6, -5, -2, -5, 5)) {",
  "    return Blocks.BONE_BLOCK;",
  "}")),

 dict(cls="GiantMushroom", doc="A mushroom twenty-three blocks across.",
      reach=12, height=80, crater=20, depth=6, power="5.0", spark="HAPPY_VILLAGER",
      shout="GIANT MUSHROOM", shape=L(
  "if (y >= 0 && y <= 8 && Sculpture.blob(x, y, z, 0, 0, 0, 11, 9, 11)) {",
  "    return y > 2 ? Blocks.RED_CONCRETE : Blocks.WHITE_CONCRETE;",
  "}",
  "if (Sculpture.post(x, z, 0, 0, 3.0) && y >= -10 && y < 1) {",
  "    return Blocks.WHITE_CONCRETE;",
  "}")),

 dict(cls="GiantSword", doc="A sword driven into the ground point first.",
      reach=22, height=110, crater=14, depth=26, power="9.0", spark="END_ROD",
      shout="THE SWORD", shape=L(
  "if (Sculpture.post(x, z, 0, 0, 1.6) && y >= -20 && y < -12) {",
  "    return Blocks.OAK_LOG;",
  "}",
  "if (Sculpture.slab(x, y, z, -5, 5, -12, -10, -2, 2)) {",
  "    return Blocks.GOLD_BLOCK;",
  "}",
  "// The blade narrows smoothly to a point rather than in steps.",
  "if (y >= -10 && y <= 20 && Math.abs(z) <= 1) {",
  "    double width = 3.0 * (1.0 - Math.max(0.0, y - 8.0) / 12.0);",
  "    if (width > 0 && Math.abs(x) <= width) {",
  "        return Blocks.IRON_BLOCK;",
  "    }",
  "}")),

 dict(cls="GiantBell", doc="A bell, which rings once, very loudly.",
      reach=14, height=90, crater=18, depth=10, power="8.0", spark="NOTE",
      shout="THE BELL", shape=L(
  "// A bell is a flared shell: the wall stays two thick while the radius",
  "// grows toward the rim, which a solid cone would not do.",
  "if (y >= -12 && y <= 6) {",
  "    double t = (y + 12) / 22.0;",
  "    double outer = 3.0 + 7.0 * Math.pow(1.0 - t, 1.4);",
  "    double d = Math.sqrt((double) x * x + (double) z * z);",
  "    if (d <= outer && d >= outer - 2.0) {",
  "        return Blocks.GOLD_BLOCK;",
  "    }",
  "    if (y == -12 && d <= outer) {",
  "        return Blocks.GOLD_BLOCK;",
  "    }",
  "}",
  "if (Sculpture.post(x, z, 0, 0, 1.2) && y > 6 && y <= 12) {",
  "    return Blocks.OAK_LOG;",
  "}")),

 dict(cls="GiantTrophy", doc="A winner's cup, for when subtlety is not required.",
      reach=12, height=85, crater=16, depth=7, power="6.0", spark="END_ROD",
      shout="THE TROPHY", shape=L(
  "double d = Math.sqrt((double) x * x + (double) z * z);",
  "if (y >= 0 && y <= 9) {",
  "    double outer = 7.0 - y * 0.15;",
  "    if (d <= outer && d >= outer - 1.5) {",
  "        return Blocks.GOLD_BLOCK;",
  "    }",
  "}",
  "if (y == 0 && d <= 7.0) {",
  "    return Blocks.GOLD_BLOCK;",
  "}",
  "if (Sculpture.post(x, z, 0, 0, 1.6) && y >= -5 && y < 0) {",
  "    return Blocks.GOLD_BLOCK;",
  "}",
  "if (Sculpture.slab(x, y, z, -8, 8, -9, -6, -8, 8)) {",
  "    return Blocks.OAK_LOG;",
  "}")),

 dict(cls="GiantDice", doc="A die seventeen blocks on a side, pips and all.",
      reach=10, height=80, crater=16, depth=7, power="6.0", spark="CRIT",
      shout="THE DIE", shape=L(
  "// Pips only on the six faces, laid out from the two coordinates that are",
  "// not pinned — which is what makes them read the same on every side.",
  "if (Math.max(Math.abs(x), Math.max(Math.abs(y), Math.abs(z))) <= 8) {",
  "    if (Math.abs(x) == 8 && pip(y, z)) {",
  "        return Blocks.BLACK_CONCRETE;",
  "    }",
  "    if (Math.abs(y) == 8 && pip(x, z)) {",
  "        return Blocks.BLACK_CONCRETE;",
  "    }",
  "    if (Math.abs(z) == 8 && pip(x, y)) {",
  "        return Blocks.BLACK_CONCRETE;",
  "    }",
  "    return Blocks.WHITE_CONCRETE;",
  "}")),

 dict(cls="GiantDonut", doc="A doughnut. A torus, if you want to be formal about it.",
      reach=14, height=80, crater=18, depth=6, power="5.0", spark="HAPPY_VILLAGER",
      shout="THE DOUGHNUT", shape=L(
  "// A torus: distance from a circle of radius eight, rather than from a",
  "// point. Four blocks of dough around it, iced on top.",
  "double ring = Math.sqrt((double) x * x + (double) z * z) - 8.0;",
  "if (ring * ring + (double) y * y <= 16.0) {",
  "    return y > 1 ? Blocks.PINK_CONCRETE : Blocks.BROWN_CONCRETE;",
  "}")),

 dict(cls="GiantRocket", doc="A rocket, arriving the wrong way up.",
      reach=22, height=120, crater=22, depth=18, power="12.0", spark="FLAME",
      shout="THE ROCKET", shape=L(
  "if (Sculpture.post(x, z, 0, 0, 4.0) && y >= -10 && y <= 12) {",
  "    return Blocks.WHITE_CONCRETE;",
  "}",
  "if (y > 12 && y <= 21 && Sculpture.post(x, z, 0, 0, 4.0 * (1.0 - (y - 12) / 9.0))) {",
  "    return Blocks.RED_CONCRETE;",
  "}",
  "// Four fins, on both axes.",
  "for (int s = -1; s <= 1; s += 2) {",
  "    if (Math.abs(z - s * 5) <= 1 && Math.abs(x) <= 1 && y >= -14 && y < -6) {",
  "        return Blocks.RED_CONCRETE;",
  "    }",
  "    if (Math.abs(x - s * 5) <= 1 && Math.abs(z) <= 1 && y >= -14 && y < -6) {",
  "        return Blocks.RED_CONCRETE;",
  "    }",
  "}")),

 dict(cls="GiantTeapot", doc="The Utah teapot, at last rendered in dirt and ruin.",
      reach=14, height=85, crater=18, depth=7, power="6.0", spark="CLOUD",
      shout="THE TEAPOT", shape=L(
  "if (y >= -4 && Sculpture.blob(x, y, z, 0, 0, 0, 8, 6, 8)) {",
  "    return Blocks.WHITE_CONCRETE;",
  "}",
  "if (y > 6 && Sculpture.post(x, z, 0, 0, 2.5 - (y - 6) * 0.3)) {",
  "    return Blocks.WHITE_CONCRETE;",
  "}",
  "// Spout and handle are arcs — a ring in the XY plane, thin in Z.",
  "if (Math.abs(z) <= 2 && x > 4) {",
  "    double d = Math.sqrt((x - 9.0) * (x - 9.0) + (y - 1.0) * (y - 1.0));",
  "    if (d >= 2.0 && d <= 4.0) {",
  "        return Blocks.WHITE_CONCRETE;",
  "    }",
  "}",
  "if (Math.abs(z) <= 1) {",
  "    double d = Math.sqrt((x + 9.0) * (x + 9.0) + (y - 1.0) * (y - 1.0));",
  "    if (d >= 2.5 && d <= 4.5) {",
  "        return Blocks.WHITE_CONCRETE;",
  "    }",
  "}")),
]

for s in SCULPTURES:
    body = TEMPLATE.format(**s)
    if s["cls"] == "GiantDice":
        body = body.replace("        return null;\n    }\n}",
                            "        return null;\n    }\n\n"
                            "    /** Two pips on a face, on opposite corners plus a centre. */\n"
                            "    private static boolean pip(int a, int b) {\n"
                            "        if (a * a + b * b <= 4) {\n"
                            "            return true;\n"
                            "        }\n"
                            "        return (Math.abs(a - 4) <= 2 && Math.abs(b - 4) <= 2)\n"
                            "                || (Math.abs(a + 4) <= 2 && Math.abs(b + 4) <= 2);\n"
                            "    }\n}")
    (OUT / f"{s['cls']}Item.java").write_text(body)

print(f"wrote {len(SCULPTURES)} sculpture classes")
