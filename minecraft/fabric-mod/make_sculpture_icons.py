#!/usr/bin/env python3
"""Render each sculpture's icon from its own shape.

Hand-drawing twelve icons costs more than the twelve items did, and a
hand-drawn icon can disagree with the thing it stands for — which is the one
job an icon has. Rendering the side-on silhouette instead means the picture is
the sculpture by construction: change the shape and the icon follows.

The projection takes the nearest occupied block along Z for each column, so
what shows is the surface facing the viewer rather than a flat cut through the
middle, which would lose anything set slightly to one side.
"""
import math
from pathlib import Path
from make_icon import write_png

def ball(x, y, z, cx, cy, cz, r):
    return (x-cx)**2 + (y-cy)**2 + (z-cz)**2 <= r*r

def blob(x, y, z, cx, cy, cz, rx, ry, rz):
    return ((x-cx)/rx)**2 + ((y-cy)/ry)**2 + ((z-cz)/rz)**2 <= 1.0

def slab(x, y, z, x0, x1, y0, y1, z0, z1):
    return x0 <= x <= x1 and y0 <= y <= y1 and z0 <= z <= z1

def post(x, z, cx, cz, r):
    return (x-cx)**2 + (z-cz)**2 <= r*r

W = (250, 250, 246, 255); K = (26, 24, 28, 255); O = (240, 146, 44, 255)
R = (200, 52, 56, 255);   I = (196, 200, 210, 255); N = (140, 102, 60, 255)
G = (248, 206, 74, 255);  B = (250, 244, 236, 255); P = (244, 154, 178, 255)
BR = (128, 88, 58, 255);  BN = (232, 228, 214, 255)

def chicken(x, y, z):
    if blob(x,y,z,0,0,0,6,5,4): return W
    if ball(x,y,z,5,6,0,3.0):
        if ball(x,y,z,7.4,6.8,1.3,0.7) or ball(x,y,z,7.4,6.8,-1.3,0.7): return K
        return W
    if blob(x,y,z,8.4,5.4,0,2.0,1.0,1.2): return O
    if ball(x,y,z,4.6,9.2,0,1.6): return R
    for lz in (2,-2):
        if abs(x-1)<=1 and abs(z-lz)<=1 and -9<=y<-5: return O
    if blob(x,y,z,-6.5,2,0,2.5,3.0,1.2): return W
    return None

def boot(x, y, z):
    taper = 5.0 - max(0, y)*0.06
    if -2 <= y <= 12 and abs(x) <= taper and abs(z) <= taper: return K
    if -8 <= y < -2 and -5 <= z <= 5:
        toe = math.sqrt(max(0.0, 36.0-(x-4)**2)) if x > 4 else 6.0
        if -5 <= x <= 10 and abs(z) <= min(5.0, toe): return K
    if -11 <= y < -8 and -6 <= x <= 11 and abs(z) <= 5: return BR
    return None

def hammer(x, y, z):
    if slab(x,y,z,-8,8,6,14,-6,6): return I
    if post(x,z,0,0,2.2) and -14 <= y < 6: return N
    return None

def skull(x, y, z):
    if ball(x,y,z,0,4,0,7.5):
        if ball(x,y,z,5.2,5.4,2.8,2.2) or ball(x,y,z,5.2,5.4,-2.8,2.2): return None
        if ball(x,y,z,6.6,2.0,0,1.4): return None
        return BN
    if slab(x,y,z,-3,6,-5,-2,-5,5): return BN
    return None

def mushroom(x, y, z):
    if 0 <= y <= 8 and blob(x,y,z,0,0,0,11,9,11): return R if y > 2 else W
    if post(x,z,0,0,3.0) and -10 <= y < 1: return W
    return None

def sword(x, y, z):
    if post(x,z,0,0,1.6) and -20 <= y < -12: return N
    if slab(x,y,z,-5,5,-12,-10,-2,2): return G
    if -10 <= y <= 20 and abs(z) <= 1:
        width = 3.0*(1.0 - max(0.0, y-8.0)/12.0)
        if width > 0 and abs(x) <= width: return I
    return None

def bell(x, y, z):
    if -12 <= y <= 6:
        t = (y+12)/22.0
        outer = 3.0 + 7.0*(1.0-t)**1.4
        d = math.sqrt(x*x + z*z)
        if outer-2.0 <= d <= outer: return G
        if y == -12 and d <= outer: return G
    if post(x,z,0,0,1.2) and 6 < y <= 12: return N
    return None

def trophy(x, y, z):
    d = math.sqrt(x*x + z*z)
    if 0 <= y <= 9:
        outer = 7.0 - y*0.15
        if outer-1.5 <= d <= outer: return G
    if y == 0 and d <= 7.0: return G
    if post(x,z,0,0,1.6) and -5 <= y < 0: return G
    if slab(x,y,z,-8,8,-9,-6,-8,8): return N
    return None

def pip(a, b):
    if a*a + b*b <= 4: return True
    return (abs(a-4) <= 2 and abs(b-4) <= 2) or (abs(a+4) <= 2 and abs(b+4) <= 2)

def dice(x, y, z):
    if max(abs(x), abs(y), abs(z)) <= 8:
        if abs(x) == 8 and pip(y, z): return K
        if abs(y) == 8 and pip(x, z): return K
        if abs(z) == 8 and pip(x, y): return K
        return W
    return None

def donut(x, y, z):
    ring = math.sqrt(x*x + z*z) - 8.0
    if ring*ring + y*y <= 16.0: return P if y > 1 else BR
    return None

def rocket(x, y, z):
    if post(x,z,0,0,4.0) and -10 <= y <= 12: return W
    if 12 < y <= 21 and post(x,z,0,0,4.0*(1.0-(y-12)/9.0)): return R
    for s in (-1, 1):
        if abs(z-s*5) <= 1 and abs(x) <= 1 and -14 <= y < -6: return R
        if abs(x-s*5) <= 1 and abs(z) <= 1 and -14 <= y < -6: return R
    return None

def teapot(x, y, z):
    if y >= -4 and blob(x,y,z,0,0,0,8,6,8): return W
    if 6 < y <= 14 and post(x,z,0,0,2.5-(y-6)*0.3): return W
    if abs(z) <= 2 and x > 4:
        d = math.sqrt((x-9.0)**2 + (y-1.0)**2)
        if 2.0 <= d <= 4.0: return W
    if abs(z) <= 1:
        d = math.sqrt((x+9.0)**2 + (y-1.0)**2)
        if 2.5 <= d <= 4.5: return W
    return None

SHAPES = {
    "giant_chicken": (chicken, 12), "giant_boot": (boot, 14),
    "giant_hammer": (hammer, 16),   "giant_skull": (skull, 10),
    "giant_mushroom": (mushroom, 12), "giant_sword": (sword, 22),
    "giant_bell": (bell, 14),       "giant_trophy": (trophy, 12),
    "giant_dice": (dice, 10),       "giant_donut": (donut, 14),
    "giant_rocket": (rocket, 22),   "giant_teapot": (teapot, 14),
}

TRANSPARENT = (0, 0, 0, 0)

# Shapes that only read from above. A torus seen side-on is a band.
TOP_DOWN = {"giant_donut"}

def render(fn, reach, size=16, top=False):
    # Find the real extent first: scaling to the reach rather than to the
    # sculpture leaves tall thin things (the sword) as a few pixels in a sea
    # of nothing.
    solid = []
    for x in range(-reach, reach+1):
        for y in range(-reach, reach+1):
            for z in range(-reach, reach+1):
                if fn(x, y, z) is not None:
                    solid.append((x, z, y) if top else (x, y, z))
    if not solid:
        return [[TRANSPARENT]*size for _ in range(size)]
    xs = [p[0] for p in solid]; ys = [p[1] for p in solid]
    lo_x, hi_x = min(xs), max(xs)
    lo_y, hi_y = min(ys), max(ys)
    span = max(hi_x-lo_x, hi_y-lo_y) + 1
    mid_x = (lo_x+hi_x)/2.0
    mid_y = (lo_y+hi_y)/2.0

    grid = []
    for row in range(size):
        line = []
        for col in range(size):
            # One pixel covers more than one block, so sample across the
            # whole cell rather than at its centre. Point-sampling drops any
            # feature thinner than a pixel — it lost the teapot's spout and
            # its lid entirely, which is the sort of gap that reads as a
            # broken icon rather than a small one.
            scale = span / size
            hit = TRANSPARENT
            for sub_x in (0.25, 0.75):
                for sub_y in (0.25, 0.75):
                    wx = int(round(mid_x + (col + sub_x - size/2.0) * scale))
                    wy = int(round(mid_y - (row + sub_y - size/2.0) * scale))
                    # Nearest occupied block toward the viewer, so what shows
                    # is the surface facing out.
                    for z in range(reach, -reach-1, -1):
                        got = fn(wx, z, wy) if top else fn(wx, wy, z)
                        if got is not None:
                            hit = got
                    if hit[3]:
                        break
                if hit[3]:
                    break
            line.append(hit)
        grid.append(line)
    return grid

if __name__ == "__main__":
    art = Path(__file__).parent / "src/main/resources/assets/orbital/textures/item"
    for name, (fn, reach) in SHAPES.items():
        pixels = render(fn, reach, top=(name in TOP_DOWN))
        filled = sum(1 for row in pixels for p in row if p[3])
        assert filled > 20, f"{name} rendered almost empty ({filled} pixels)"
        write_png(art / f"{name}.png", pixels)
        print(f"wrote {name}.png ({filled}/256 pixels)")
