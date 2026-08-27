#!/usr/bin/env python3
"""Draw icons for items that are not sculptures.

A weapon or a gadget has no 3D shape to render, so these are composed from a
handful of primitives — a barrel, a grip, a ring, a burst, a spark — arranged
per item. That is still a drawing, but it is a drawing made of parts that are
consistent across the whole set, which is what stops fifty hand-drawn icons
from looking like fifty different mods.
"""
from pathlib import Path
from make_icon import write_png

T = (0, 0, 0, 0)
STEEL = (188, 194, 206, 255); DARK = (92, 98, 112, 255); GRIP = (96, 68, 48, 255)
HOT = (238, 104, 48, 255);    GLOW = (255, 214, 108, 255); COLD = (126, 216, 244, 255)
VOID = (52, 40, 72, 255);     ACID = (150, 226, 96, 255);  BONE = (232, 228, 214, 255)
PINK = (244, 154, 178, 255);  GREEN = (120, 200, 110, 255); BLUE = (70, 138, 220, 255)
WHITE = (250, 250, 246, 255); BLACK = (28, 26, 30, 255);   GOLD = (248, 206, 74, 255)

def blank():
    return [[T]*16 for _ in range(16)]

def rect(g, x0, y0, x1, y1, c):
    for y in range(max(0, y0), min(16, y1+1)):
        for x in range(max(0, x0), min(16, x1+1)):
            g[y][x] = c

def disc(g, cx, cy, r, c, inner=0):
    for y in range(16):
        for x in range(16):
            d = (x-cx)**2 + (y-cy)**2
            if inner*inner <= d <= r*r:
                g[y][x] = c

def diag(g, x0, y0, steps, dx, dy, c, thick=1):
    for i in range(steps):
        for t in range(thick):
            x, y = x0 + dx*i + t, y0 + dy*i
            if 0 <= x < 16 and 0 <= y < 16:
                g[y][x] = c

def gun(barrel, accent):
    """The house style for anything you point: barrel, muzzle, grip."""
    g = blank()
    rect(g, 2, 5, 12, 8, barrel)
    rect(g, 3, 6, 11, 7, DARK)
    rect(g, 12, 4, 14, 9, accent)
    rect(g, 3, 9, 6, 13, GRIP)
    return g

def burst(core, ray):
    g = blank()
    disc(g, 7, 7, 4, core)
    for a, (dx, dy) in enumerate(((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1))):
        diag(g, 7+dx*5, 7+dy*5, 3, dx, dy, ray)
    return g

GLYPHS = {}

GLYPHS["disintegrator"] = gun(STEEL, PINK)
GLYPHS["black_hole_grenade"] = (lambda: (
    lambda g: (disc(g, 7, 8, 6, VOID), disc(g, 7, 8, 3, BLACK),
               rect(g, 6, 1, 8, 2, STEEL), g)[-1])(blank()))()
GLYPHS["napalm_launcher"] = gun(DARK, HOT)
GLYPHS["earthquake_hammer"] = (lambda: (
    lambda g: (rect(g, 2, 1, 13, 5, STEEL), rect(g, 3, 2, 12, 4, DARK),
               rect(g, 7, 6, 8, 15, GRIP), g)[-1])(blank()))()
GLYPHS["swarm_missiles"] = (lambda: (
    lambda g: ([rect(g, 2+i*5, 3, 4+i*5, 9, STEEL) for i in range(3)],
               [rect(g, 2+i*5, 10, 4+i*5, 12, HOT) for i in range(3)],
               [rect(g, 3+i*5, 1, 3+i*5, 2, HOT) for i in range(3)], g)[-1])(blank()))()
GLYPHS["shotgun_blast"] = gun(GRIP, STEEL)
GLYPHS["acid_spray"] = gun(GREEN, ACID)
GLYPHS["sonic_cannon"] = (lambda: (
    lambda g: (rect(g, 1, 6, 7, 9, STEEL),
               [disc(g, 7, 7, 5+i*3, WHITE, 4+i*3) for i in range(3)], g)[-1])(blank()))()
GLYPHS["chain_lightning"] = (lambda: (
    lambda g: (diag(g, 9, 0, 4, -1, 1, GLOW, 2), diag(g, 6, 4, 3, 1, 1, GLOW, 2),
               diag(g, 9, 7, 4, -1, 1, GLOW, 2), diag(g, 6, 11, 3, 1, 1, GLOW, 2), g)[-1])(blank()))()
GLYPHS["ice_spikes"] = (lambda: (
    lambda g: ([rect(g, 1+i*4, 14-i*3 if i < 2 else 8, 3+i*4, 15, COLD) for i in range(4)],
               [rect(g, 2+i*4, 10-i*2, 2+i*4, 13, COLD) for i in range(4)], g)[-1])(blank()))()
GLYPHS["landmine"] = (lambda: (
    lambda g: (disc(g, 7, 10, 6, DARK), disc(g, 7, 10, 4, STEEL),
               rect(g, 6, 3, 8, 5, HOT), g)[-1])(blank()))()
GLYPHS["nuke_suitcase"] = (lambda: (
    lambda g: (rect(g, 1, 4, 14, 14, GRIP), rect(g, 2, 5, 13, 13, DARK),
               rect(g, 6, 1, 9, 3, GRIP), disc(g, 7, 9, 4, GLOW), disc(g, 7, 9, 2, BLACK),
               g)[-1])(blank()))()

if __name__ == "__main__":
    art = Path(__file__).parent / "src/main/resources/assets/orbital/textures/item"
    for name, pixels in sorted(GLYPHS.items()):
        assert len(pixels) == 16 and all(len(r) == 16 for r in pixels), name
        filled = sum(1 for row in pixels for p in row if p[3])
        assert filled > 20, f"{name} is nearly empty ({filled} pixels)"
        write_png(art / f"{name}.png", pixels)
        print(f"wrote {name}.png ({filled}/256)")
