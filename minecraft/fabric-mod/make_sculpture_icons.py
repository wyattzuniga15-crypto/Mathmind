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

GL = (206, 232, 238, 255); SD = (226, 210, 158, 255); DI = (120, 226, 220, 255)

# The four below mirror the paint() methods in their Java items block for
# block. If one drifts, the icon stops being a picture of the sculpture, so
# they are worth reading side by side rather than "roughly the same shape".

def crown(x, y, z):
    d = math.sqrt(x*x + z*z)
    band = 8.0 <= d <= 10.0
    if 0 <= y <= 5 and band: return G
    if 5 < y <= 15 and band:
        a = math.atan2(z, x)
        for k in range(8):
            want = k*math.pi/4.0
            off = abs(math.atan2(math.sin(a-want), math.cos(a-want)))
            if off <= 0.30*(1.0 - (y-5)/10.0):
                return DI if y > 12 else G
    return None

def gramophone(x, y, z):
    if slab(x,y,z,-8,8,-6,-3,-8,8): return N
    if post(x,z,0,0,1.0) and -3 < y <= 6: return I
    for t in range(13):
        f = t/12.0
        hx = 9.0*f; hy = 6.0 + 8.0*f; r = 1.0 + 6.0*f
        if abs(y-hy) <= 1 and abs(math.sqrt((x-hx)**2 + z*z) - r) <= 1.2: return G
    return None

def hourglass(x, y, z):
    if abs(y) > 14: return None
    r = 2.0 + 7.0*(abs(y)/14.0)
    d = math.sqrt(x*x + z*z)
    if abs(y) == 14 and d <= r: return N
    if r-1.5 <= d <= r: return GL
    if -13 <= y < -6 and d <= r-1.5: return SD
    return None

def anchor(x, y, z):
    if post(x,z,0,0,1.6) and -8 <= y <= 14: return I
    if abs(z) <= 1.6 and abs(y-11) <= 1.6 and abs(x) <= 8: return I
    arm = math.sqrt(x*x + (y+8.0)**2)
    if 9.0 <= arm <= 11.0 and y < -2 and abs(z) <= 1.6: return I
    return None

SP = (156, 122, 84, 255); DK = (72, 52, 34, 255); ST = (198, 202, 210, 255)
SN = (232, 224, 190, 255); CH = (128, 88, 58, 255); LB = (250, 244, 236, 255)

# Batch K, mirroring gen_sculptures.py block for block. The icon is the
# sculpture only for as long as these two agree.

def guitar(x, y, z):
    if -16 <= x <= -2 and abs(y) <= 2:
        t = (x + 16) / 14.0
        wide = 7.0 - 3.4 * math.exp(-((t - 0.52) ** 2) / 0.012)
        if abs(z) <= wide:
            if abs(y) <= 1 and abs(z) <= wide - 2 and -14 <= x <= -4: return None
            if y == 2 and (x + 6) ** 2 + z * z <= 9: return None
            return SP
    if -2 < x <= 15 and abs(z) <= 1.6 and -1 <= y <= 1: return DK
    if 15 < x <= 18 and abs(z) <= 2.6 and -1 <= y <= 1: return DK
    if -1 <= x <= 17 and y == 2 and abs(z) <= 1: return ST
    return None

def lighthouse(x, y, z):
    d = math.sqrt(x*x + z*z)
    if -18 <= y <= 8:
        r = 7.0 - 3.0 * (y + 18) / 26.0
        if d <= r and d >= r - 1.5:
            return R if ((y + 18) // 4) % 2 == 0 else W
        return None
    if 8 < y <= 11 and post(x, z, 0, 0, 5.0): return K
    if 11 < y <= 15:
        if 3.0 <= d <= 4.0: return GL
        if d < 3.0: return LB
    if 15 < y <= 18 and post(x, z, 0, 0, 5.0 - (y - 15) * 1.4): return K
    return None

def key(x, y, z):
    if abs(z) > 1: return None
    ring = math.sqrt(x*x + (y - 9.0) ** 2)
    if 4.0 <= ring <= 6.5 and y > 4: return G
    if abs(x) <= 1.5 and -16 <= y <= 4: return G
    if ((abs(y + 9) <= 1 and 1.5 < x <= 5.5)
            or (abs(y + 12) <= 1 and 1.5 < x <= 6.5)
            or (abs(y + 15) <= 1 and 1.5 < x <= 4.5)): return G
    return None

def ice_cream(x, y, z):
    if -18 <= y < -2:
        d = math.sqrt(x*x + z*z)
        if d <= 7.0 * (y + 18) / 16.0:
            return CH if (x + y + z) % 5 == 0 else SN
    if ball(x, y, z, 0, -1, 0, 7.0): return W
    if ball(x, y, z, 2, 7, -1, 6.0): return P
    if ball(x, y, z, -1, 13, 2, 4.5): return CH
    if ball(x, y, z, -1, 18, 2, 1.8): return R
    if x == -1 and z == 2 and 19 < y <= 20: return N
    return None

def windmill(x, y, z):
    d = math.sqrt(x*x + z*z)
    if -16 <= y <= 6:
        r = 7.0 - 3.5 * (y + 16) / 22.0
        if r - 1.5 <= d <= r: return W
        if y == -16 and d <= r: return W
    if 6 < y <= 10 and d <= 7.0 - (y - 6) * 1.6: return R
    if abs(z + 8.0) <= 1.5:
        rr = math.sqrt(x*x + (y - 2.0) ** 2)
        if rr <= 2.0: return N
        if rr <= 14.0:
            a = math.atan2(y - 2.0, x)
            for k in range(4):
                want = math.pi / 4.0 + k * math.pi / 2.0
                off = abs(math.atan2(math.sin(a - want), math.cos(a - want)))
                if off <= 0.16: return N
                if off <= 0.42 and rr > 4.0: return LB
    return None

BL = (72, 108, 196, 255); YE = (240, 208, 72, 255); DP = (58, 56, 66, 255)

# Batch L, mirroring gen_sculptures.py block for block.

def hot_air_balloon(x, y, z):
    if 2 <= y <= 18:
        t = (y - 2) / 16.0
        r = 11.0 * math.sin(math.pi * (0.18 + 0.72 * t))
        d = math.sqrt(x*x + z*z)
        if r - 1.5 <= d <= r:
            return (R, W, YE, BL)[int((math.atan2(z, x) + math.pi) / (math.pi / 2.0)) % 4]
    if abs(x) == 4 and abs(z) == 4 and -6 <= y < 2: return N
    if -12 <= y <= -6 and max(abs(x), abs(z)) <= 5 \
            and (y == -12 or max(abs(x), abs(z)) >= 4): return N
    return None

def chess_knight(x, y, z):
    d = math.sqrt(x*x + z*z)
    if -18 <= y <= -13 and d <= 9.0 - (y + 18) * 0.5: return DP
    if abs(z) > 5: return None
    lean = (y + 13) * 0.30
    if -13 < y <= 5 and abs(x + lean - 1.0) <= 4.0 - (y + 13) * 0.08: return DP
    if 5 < y <= 13 and -8 <= x <= 0 and abs(z) <= 4: return DP
    if 6 <= y <= 11 and -13 <= x < -8 and abs(z) <= 3: return DP
    for ez in (-2, 2):
        if 13 < y <= 17 and -5 <= x <= -2 and abs(z - ez) <= 1: return DP
    return None

def light_bulb(x, y, z):
    d = math.sqrt(x*x + z*z)
    if -2 <= y <= 18:
        r = 11.0 * math.sin(math.pi * (0.12 + 0.8 * (y + 2) / 20.0))
        if r - 1.5 <= d <= r: return GL
        if d < r - 1.5:
            if abs(x) <= 1 and 2 <= y <= 10 and abs(z) <= 1: return G
            if 9 <= y <= 11 and abs(x) <= 5 and abs(z) <= 1 and (x + y) % 3 == 0: return G
            return None
    if -8 <= y < -2 and post(x, z, 0, 0, 5.0): return I
    if -16 <= y < -8 and post(x, z, 0, 0, 6.0 - ((y + 16) % 3) * 0.9): return I
    if -19 <= y < -16 and post(x, z, 0, 0, 3.0): return K
    return None

SHAPES = {
    "giant_chicken": (chicken, 12), "giant_boot": (boot, 14),
    "giant_hammer": (hammer, 16),   "giant_skull": (skull, 10),
    "giant_mushroom": (mushroom, 12), "giant_sword": (sword, 22),
    "giant_bell": (bell, 14),       "giant_trophy": (trophy, 12),
    "giant_dice": (dice, 10),       "giant_donut": (donut, 14),
    "giant_rocket": (rocket, 22),   "giant_teapot": (teapot, 14),
    "giant_crown": (crown, 16),     "giant_gramophone": (gramophone, 20),
    "giant_hourglass": (hourglass, 16), "giant_anchor": (anchor, 18),
    "giant_guitar": (guitar, 20),   "giant_lighthouse": (lighthouse, 20),
    "giant_key": (key, 18),         "giant_ice_cream": (ice_cream, 22),
    "giant_windmill": (windmill, 20),
    "giant_hot_air_balloon": (hot_air_balloon, 20),
    "giant_chess_knight": (chess_knight, 22),
    "giant_light_bulb": (light_bulb, 22),
}

TRANSPARENT = (0, 0, 0, 0)

# Shapes that only read from above. A torus seen side-on is a band.
# A torus seen side-on is a band; a guitar seen side-on is a plank.
TOP_DOWN = {"giant_donut", "giant_guitar"}

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
                    # is the surface facing out. It has to stop at the first
                    # one: letting the loop run to the end keeps the block
                    # furthest away instead, which paints the back of every
                    # sculpture over its front.
                    for z in range(reach, -reach-1, -1):
                        got = fn(wx, z, wy) if top else fn(wx, wy, z)
                        if got is not None:
                            hit = got
                            break
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
