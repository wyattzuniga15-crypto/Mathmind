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

GLYPHS["teleport_staff"] = (lambda: (
    lambda g: (rect(g, 7, 5, 8, 15, GRIP), disc(g, 7, 4, 4, VOID), disc(g, 7, 4, 2, PINK),
               g)[-1])(blank()))()
GLYPHS["wall_phase"] = (lambda: (
    lambda g: (rect(g, 1, 2, 14, 13, DARK), rect(g, 6, 4, 9, 13, T),
               [rect(g, 1, 2+i*4, 14, 2+i*4, STEEL) for i in range(3)], g)[-1])(blank()))()
GLYPHS["time_bubble"] = (lambda: (
    lambda g: (disc(g, 7, 7, 7, COLD, 6), disc(g, 7, 7, 5, WHITE),
               rect(g, 7, 3, 7, 7, DARK), rect(g, 7, 7, 10, 7, DARK), g)[-1])(blank()))()
GLYPHS["item_magnet"] = (lambda: (
    lambda g: (disc(g, 7, 8, 7, HOT, 4), rect(g, 0, 8, 15, 15, T),
               rect(g, 1, 8, 3, 14, HOT), rect(g, 11, 8, 13, 14, HOT),
               rect(g, 1, 12, 3, 14, STEEL), rect(g, 11, 12, 13, 14, STEEL), g)[-1])(blank()))()
GLYPHS["speed_boots"] = (lambda: (
    lambda g: (rect(g, 4, 5, 8, 12, STEEL), rect(g, 4, 12, 13, 14, STEEL),
               [rect(g, 0, 6+i*3, 3, 6+i*3, GLOW) for i in range(3)], g)[-1])(blank()))()
GLYPHS["water_walking"] = (lambda: (
    lambda g: (rect(g, 4, 3, 8, 10, GRIP), rect(g, 4, 10, 13, 12, GRIP),
               rect(g, 0, 13, 15, 15, BLUE), rect(g, 3, 13, 14, 13, COLD), g)[-1])(blank()))()
GLYPHS["auto_miner"] = (lambda: (
    lambda g: (rect(g, 6, 1, 9, 9, STEEL), diag(g, 5, 9, 4, 0, 1, DARK, 6),
               rect(g, 7, 13, 8, 15, DARK), g)[-1])(blank()))()
GLYPHS["block_printer"] = (lambda: (
    lambda g: (rect(g, 2, 2, 13, 8, STEEL), rect(g, 4, 4, 11, 6, DARK),
               [rect(g, 2+i*4, 11, 5+i*4, 14, GRIP) for i in range(3)], g)[-1])(blank()))()
GLYPHS["elevator"] = (lambda: (
    lambda g: (rect(g, 2, 11, 13, 14, WHITE),
               [diag(g, 7, 9-i*3, 1, 0, 0, GLOW) for i in range(3)],
               [rect(g, 5+i, 8-i*3, 10-i, 9-i*3, GLOW) for i in range(3)], g)[-1])(blank()))()
GLYPHS["ore_finder"] = (lambda: (
    lambda g: (disc(g, 7, 6, 6, GOLD, 4), rect(g, 9, 10, 13, 14, GOLD),
               disc(g, 7, 6, 3, COLD), g)[-1])(blank()))()
GLYPHS["supply_drop"] = (lambda: (
    lambda g: (rect(g, 3, 6, 12, 14, GRIP), rect(g, 3, 8, 12, 9, DARK),
               rect(g, 7, 6, 8, 14, DARK), disc(g, 7, 3, 4, WHITE, 3), g)[-1])(blank()))()
GLYPHS["homing_compass"] = (lambda: (
    lambda g: (disc(g, 7, 7, 7, GOLD, 5), disc(g, 7, 7, 5, WHITE),
               diag(g, 7, 3, 5, 0, 1, HOT), diag(g, 5, 5, 3, 1, 1, HOT), g)[-1])(blank()))()

GREY = (150, 150, 156, 255); SNOW = (240, 248, 252, 255); LEAF = (96, 168, 78, 255)
BARK = (118, 84, 52, 255);   SKY = (128, 196, 240, 255)

GLYPHS["forest_grower"] = (lambda: (
    lambda g: ([disc(g, 3+i*5, 6, 3, LEAF) for i in range(3)],
               [rect(g, 3+i*5, 9, 3+i*5, 14, BARK) for i in range(3)], g)[-1])(blank()))()
GLYPHS["mountain_maker"] = (lambda: (
    lambda g: ([rect(g, 7-i, 6+i, 8+i, 6+i, GREY) for i in range(9)],
               [rect(g, 7-i, 6+i, 8+i, 6+i, SNOW) for i in range(2)], g)[-1])(blank()))()
GLYPHS["canyon_carver"] = (lambda: (
    lambda g: (rect(g, 0, 4, 15, 15, GREY),
               [rect(g, 6-i//3, 4+i, 9+i//3, 4+i, T) for i in range(12)], g)[-1])(blank()))()
GLYPHS["ice_age"] = (lambda: (
    lambda g: (rect(g, 0, 9, 15, 15, SNOW), rect(g, 0, 11, 15, 15, COLD),
               [diag(g, 2+i*5, 1, 5, 0, 1, SNOW) for i in range(3)],
               [rect(g, 1+i*5, 3, 4+i*5, 3, SNOW) for i in range(3)], g)[-1])(blank()))()
GLYPHS["maze_maker"] = (lambda: (
    lambda g: (rect(g, 1, 1, 14, 14, GREY),
               [rect(g, 3+i*4, 1, 3+i*4, 10, T) for i in range(3)],
               [rect(g, 1, 3+i*4, 12, 3+i*4, T) for i in range(3)], g)[-1])(blank()))()
GLYPHS["road_builder"] = (lambda: (
    lambda g: (rect(g, 0, 8, 15, 15, GREY),
               [rect(g, 1+i*5, 11, 4+i*5, 12, GLOW) for i in range(3)],
               rect(g, 0, 8, 15, 8, DARK), g)[-1])(blank()))()
GLYPHS["bridge_builder"] = (lambda: (
    lambda g: (rect(g, 0, 7, 15, 9, BARK), rect(g, 0, 5, 15, 5, BARK),
               [rect(g, 1+i*4, 5, 1+i*4, 7, BARK) for i in range(4)],
               rect(g, 0, 13, 3, 15, GREY), rect(g, 12, 13, 15, 15, GREY), g)[-1])(blank()))()
GLYPHS["tower_builder"] = (lambda: (
    lambda g: (rect(g, 5, 3, 10, 15, GREY), rect(g, 4, 1, 11, 3, DARK),
               [rect(g, 6, 6+i*4, 9, 7+i*4, T) for i in range(3)], g)[-1])(blank()))()
GLYPHS["weather_control"] = (lambda: (
    lambda g: (disc(g, 6, 5, 4, WHITE), disc(g, 10, 6, 3, WHITE),
               rect(g, 3, 6, 12, 8, WHITE),
               [rect(g, 3+i*3, 10, 3+i*3, 14, BLUE) for i in range(4)], g)[-1])(blank()))()
GLYPHS["time_of_day"] = (lambda: (
    lambda g: (disc(g, 7, 7, 5, GOLD), disc(g, 7, 7, 3, GLOW),
               [diag(g, 7+dx*7, 7+dy*7, 1, dx, dy, GOLD)
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))], g)[-1])(blank()))()
GLYPHS["meteor_crater"] = (lambda: (
    lambda g: (disc(g, 7, 9, 7, GREY), disc(g, 7, 9, 5, DARK), disc(g, 7, 9, 2, HOT),
               diag(g, 12, 0, 4, -1, 1, HOT, 2), g)[-1])(blank()))()
GLYPHS["dungeon_maker"] = (lambda: (
    lambda g: (rect(g, 1, 5, 14, 14, GREY), rect(g, 3, 7, 12, 12, DARK),
               disc(g, 4, 8, 1, GLOW), disc(g, 11, 8, 1, GLOW),
               rect(g, 6, 1, 9, 5, DARK), g)[-1])(blank()))()

RED = (214, 62, 62, 255); YEL = (248, 214, 76, 255); PUR = (168, 96, 214, 255)
MOSS = (108, 130, 84, 255); ROCK = (132, 132, 134, 255)

GLYPHS["firework_show"] = (lambda: (
    lambda g: (rect(g, 7, 9, 8, 15, GRIP),
               [diag(g, 7+dx*2, 7+dy*2, 4, dx, dy, [RED, YEL, PUR, COLD][i % 4])
                for i, (dx, dy) in enumerate(((1,0),(-1,0),(0,-1),(1,-1),(-1,-1),(1,1),(-1,1)))],
               disc(g, 7, 6, 2, WHITE), g)[-1])(blank()))()
GLYPHS["disco_floor"] = (lambda: (
    lambda g: ([rect(g, i*4, j*4, i*4+3, j*4+3,
                     [RED, YEL, PUR, COLD, GREEN, HOT, PINK, GOLD][(i+j*2) % 8])
                for i in range(4) for j in range(4)], g)[-1])(blank()))()
GLYPHS["confetti_cannon"] = (lambda: (
    lambda g: (rect(g, 1, 9, 7, 13, DARK), rect(g, 7, 8, 9, 14, STEEL),
               [rect(g, 9+i, 1+(i*3) % 8, 10+i, 2+(i*3) % 8, [RED, YEL, PUR, COLD, PINK][i % 5])
                for i in range(6)], g)[-1])(blank()))()
GLYPHS["bouncy_ground"] = (lambda: (
    lambda g: (rect(g, 0, 10, 15, 15, GREEN), rect(g, 1, 11, 14, 14, ACID),
               disc(g, 7, 4, 3, GREEN), [rect(g, 4+i*3, 8, 5+i*3, 9, ACID) for i in range(3)],
               g)[-1])(blank()))()
GLYPHS["rainbow_trail"] = (lambda: (
    lambda g: ([disc(g, 7, 15, 14-i*2, [RED, HOT, YEL, GREEN, COLD, PUR][i], 13-i*2)
                for i in range(6)], g)[-1])(blank()))()
GLYPHS["pet_rock"] = (lambda: (
    lambda g: (disc(g, 7, 9, 6, ROCK), disc(g, 5, 7, 2, MOSS), disc(g, 10, 11, 2, MOSS),
               rect(g, 5, 8, 6, 9, BLACK), rect(g, 9, 8, 10, 9, BLACK), g)[-1])(blank()))()
GLYPHS["snowball_gun"] = (lambda: (
    lambda g: (rect(g, 2, 6, 11, 9, STEEL), rect(g, 3, 10, 6, 14, GRIP),
               disc(g, 13, 7, 2, WHITE), [disc(g, 13, 7, 2, SNOW)], g)[-1])(blank()))()
GLYPHS["chicken_rain"] = (lambda: (
    lambda g: ([disc(g, 3+i*5, 3+(i % 2)*6, 2, WHITE) for i in range(3)],
               [rect(g, 4+i*5, 3+(i % 2)*6, 5+i*5, 3+(i % 2)*6, HOT) for i in range(3)],
               [rect(g, 2+i*5, 6+(i % 2)*6, 2+i*5, 8+(i % 2)*6, HOT) for i in range(3)],
               g)[-1])(blank()))()
GLYPHS["boombox"] = (lambda: (
    lambda g: (rect(g, 0, 4, 15, 13, DARK), disc(g, 4, 8, 3, STEEL), disc(g, 11, 8, 3, STEEL),
               disc(g, 4, 8, 1, BLACK), disc(g, 11, 8, 1, BLACK),
               rect(g, 5, 1, 10, 2, STEEL), g)[-1])(blank()))()
GLYPHS["party_mode"] = (lambda: (
    lambda g: (rect(g, 3, 9, 12, 14, PINK), rect(g, 3, 11, 12, 12, WHITE),
               rect(g, 7, 4, 8, 8, WHITE), disc(g, 7, 3, 2, GLOW),
               [disc(g, 1+i*6, 6, 1, [RED, YEL, PUR][i]) for i in range(3)], g)[-1])(blank()))()

WHALE = (58, 82, 128, 255); BELLY = (214, 220, 228, 255); BRONZE = (156, 114, 66, 255)

GLYPHS["sky_whale_egg"] = (lambda: (
    lambda g: (disc(g, 8, 8, 6, WHALE), rect(g, 2, 8, 14, 12, WHALE),
               rect(g, 4, 10, 13, 12, BELLY), rect(g, 0, 4, 3, 12, WHALE),
               disc(g, 12, 6, 1, BLACK), g)[-1])(blank()))()
GLYPHS["titan_seal"] = (lambda: (
    lambda g: (rect(g, 6, 1, 9, 4, BRONZE), rect(g, 4, 5, 11, 10, BRONZE),
               rect(g, 1, 5, 3, 12, BRONZE), rect(g, 12, 5, 14, 12, BRONZE),
               rect(g, 5, 11, 7, 15, BRONZE), rect(g, 8, 11, 10, 15, BRONZE),
               rect(g, 6, 6, 9, 7, GLOW), g)[-1])(blank()))()

SCALE = (58, 118, 66, 255); GUN = (86, 90, 100, 255); STONE = (128, 128, 132, 255)

GLYPHS["dragon_egg_orb"] = (lambda: (
    lambda g: (disc(g, 7, 9, 6, SCALE), disc(g, 7, 9, 4, HOT),
               [rect(g, 5+i*2, 3+(i%2), 6+i*2, 4+(i%2), SCALE) for i in range(3)],
               disc(g, 7, 9, 1, GLOW), g)[-1])(blank()))()
GLYPHS["spider_core"] = (lambda: (
    lambda g: (rect(g, 4, 5, 11, 10, GUN), rect(g, 5, 6, 10, 7, HOT),
               [diag(g, 3, 5+i*2, 3, -1, 1, GUN) for i in range(3)],
               [diag(g, 12, 5+i*2, 3, 1, 1, GUN) for i in range(3)], g)[-1])(blank()))()
GLYPHS["golem_heart"] = (lambda: (
    lambda g: (rect(g, 3, 3, 12, 12, STONE), rect(g, 5, 5, 10, 10, DARK),
               disc(g, 7, 7, 3, COLD), disc(g, 7, 7, 1, WHITE), g)[-1])(blank()))()

SANDY = (226, 210, 158, 255); CYAN = (120, 226, 220, 255)
HILLS = [11, 9, 7, 6, 6, 7, 9, 10, 9, 7, 5, 4, 5, 7, 9, 11]

GLYPHS["beacon_marker"] = (lambda: (
    lambda g: (rect(g, 3, 12, 12, 15, DARK), rect(g, 4, 13, 11, 14, CYAN),
               rect(g, 6, 0, 9, 12, WHITE), rect(g, 7, 0, 8, 12, COLD), g)[-1])(blank()))()
GLYPHS["black_ice"] = (lambda: (
    lambda g: (rect(g, 0, 6, 15, 15, BLACK), rect(g, 1, 7, 14, 14, VOID),
               [diag(g, 2+i*4, 8, 5, 1, 1, COLD) for i in range(3)],
               rect(g, 0, 6, 15, 6, COLD), g)[-1])(blank()))()
GLYPHS["carpet_bomb"] = (lambda: (
    lambda g: ([disc(g, 2+i*5, 12, 2+i, HOT) for i in range(3)],
               [disc(g, 2+i*5, 12, 1+i, GLOW) for i in range(3)],
               [disc(g, 3+i*5, 4-i, 1, DARK) for i in range(3)],
               [rect(g, 3+i*5, 2-i, 3+i*5, 3-i, STEEL) for i in range(3)], g)[-1])(blank()))()
GLYPHS["cloner"] = (lambda: (
    lambda g: (rect(g, 1, 4, 7, 11, STONE), rect(g, 2, 5, 6, 10, GREY),
               rect(g, 8, 4, 14, 11, VOID),
               [rect(g, 9+(i*2) % 5, 5+i, 10+(i*2) % 5, 5+i, PINK) for i in range(6)],
               g)[-1])(blank()))()
GLYPHS["crystal_growth"] = (lambda: (
    lambda g: (rect(g, 0, 13, 15, 15, DARK),
               [rect(g, 2+i*4, 13-(4+(i*3) % 6), 4+i*4, 13, PUR) for i in range(4)],
               [rect(g, 3+i*4, 13-(4+(i*3) % 6), 3+i*4, 13, PINK) for i in range(4)],
               g)[-1])(blank()))()
GLYPHS["decoy"] = (lambda: (
    lambda g: (rect(g, 6, 1, 9, 4, BONE), rect(g, 7, 5, 8, 12, BARK),
               rect(g, 2, 6, 13, 7, BARK), rect(g, 4, 13, 11, 15, GREY),
               rect(g, 6, 2, 6, 3, BLACK), rect(g, 9, 2, 9, 3, BLACK), g)[-1])(blank()))()
GLYPHS["excavator"] = (lambda: (
    lambda g: (rect(g, 0, 4, 15, 15, GREY), rect(g, 0, 4, 15, 5, LEAF),
               rect(g, 2, 6, 13, 15, DARK), rect(g, 4, 8, 11, 15, BLACK),
               rect(g, 6, 10, 9, 15, T), g)[-1])(blank()))()
GLYPHS["featherfall"] = (lambda: (
    lambda g: ([rect(g, 10-i, 3+i, 13-i//2, 3+i, WHITE) for i in range(9)],
               diag(g, 12, 2, 12, -1, 1, BONE), diag(g, 11, 3, 12, -1, 1, GREY),
               g)[-1])(blank()))()
GLYPHS["fossilise"] = (lambda: (
    lambda g: (rect(g, 5, 1, 10, 6, STONE), rect(g, 4, 7, 11, 12, STONE),
               rect(g, 4, 13, 6, 15, STONE), rect(g, 9, 13, 11, 15, STONE),
               rect(g, 6, 3, 6, 4, BLACK), rect(g, 9, 3, 9, 4, BLACK),
               [rect(g, 5+i*2, 8+i*2, 8+i*2, 8+i*2, GREY) for i in range(3)],
               g)[-1])(blank()))()
GLYPHS["foundation"] = (lambda: (
    lambda g: (rect(g, 0, 7, 15, 15, GREY), rect(g, 0, 7, 15, 8, STONE),
               [rect(g, i*4, 9, i*4, 15, DARK) for i in range(4)],
               [rect(g, 0, 9+i*3, 15, 9+i*3, DARK) for i in range(3)], g)[-1])(blank()))()
GLYPHS["glass_cannon"] = (lambda: (
    lambda g: (disc(g, 7, 7, 7, COLD), disc(g, 7, 7, 5, WHITE),
               [diag(g, 7, 7, 7 if dx*dy == 0 else 5, dx, dy, DARK)
                for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy], g)[-1])(blank()))()
GLYPHS["hologram"] = (lambda: (
    lambda g: (rect(g, 2, 5, 10, 6, CYAN), rect(g, 2, 13, 10, 14, CYAN),
               rect(g, 2, 5, 3, 14, CYAN), rect(g, 9, 5, 10, 14, CYAN),
               diag(g, 4, 4, 4, 1, -1, CYAN), diag(g, 11, 13, 4, 1, -1, CYAN),
               rect(g, 6, 1, 14, 2, CYAN), rect(g, 13, 1, 14, 10, CYAN),
               g)[-1])(blank()))()
GLYPHS["landscaper"] = (lambda: (
    lambda g: ([rect(g, x, HILLS[x], x, 15, BARK) for x in range(16)],
               [rect(g, x, HILLS[x], x, HILLS[x]+1, LEAF) for x in range(16)],
               g)[-1])(blank()))()
GLYPHS["midas_touch"] = (lambda: (
    lambda g: (disc(g, 7, 5, 5, GLOW), disc(g, 7, 5, 3, GOLD),
               rect(g, 6, 9, 9, 13, GOLD),
               [rect(g, i*4, 12, i*4+3, 15, GOLD if i % 2 == 0 else GLOW) for i in range(4)],
               g)[-1])(blank()))()
GLYPHS["overgrowth"] = (lambda: (
    lambda g: (rect(g, 3, 6, 12, 14, GREY), rect(g, 4, 7, 11, 13, STONE),
               rect(g, 3, 6, 12, 8, MOSS),
               [disc(g, 2+i*5, 4, 3, LEAF) for i in range(3)],
               [rect(g, 4+i*4, 9, 5+i*4, 11+i % 2, MOSS) for i in range(3)],
               g)[-1])(blank()))()
GLYPHS["quicksand"] = (lambda: (
    lambda g: (rect(g, 0, 6, 15, 15, SANDY),
               [rect(g, 3+i, 7+i, 12-i, 7+i, GRIP) for i in range(5)],
               rect(g, 6, 3, 9, 7, BONE), disc(g, 7, 2, 2, BONE), g)[-1])(blank()))()
GLYPHS["repair"] = (lambda: (
    lambda g: (rect(g, 0, 6, 15, 15, GREY), rect(g, 4, 8, 11, 15, DARK),
               [rect(g, 4, 9+i*2, 11, 9+i*2, STONE) for i in range(4)],
               rect(g, 0, 6, 15, 7, LEAF), g)[-1])(blank()))()
GLYPHS["skylight"] = (lambda: (
    lambda g: (rect(g, 0, 0, 15, 3, SKY), disc(g, 12, 2, 2, GLOW),
               rect(g, 0, 4, 15, 15, GREY),
               [rect(g, 0, 6+i*3, 15, 6+i*3, DARK) for i in range(4)],
               rect(g, 5, 4, 10, 15, T), g)[-1])(blank()))()
GLYPHS["stampede"] = (lambda: (
    lambda g: (rect(g, 6, 6, 15, 12, WHITE), rect(g, 6, 6, 9, 9, BLACK),
               rect(g, 11, 8, 13, 10, BLACK), rect(g, 7, 13, 8, 15, WHITE),
               rect(g, 12, 13, 13, 15, WHITE),
               rect(g, 5, 2, 9, 6, WHITE), rect(g, 4, 3, 4, 4, BONE),
               rect(g, 6, 4, 6, 5, BLACK),
               [rect(g, 0, 7+i*3, 3, 7+i*3, GREY) for i in range(3)],
               g)[-1])(blank()))()
GLYPHS["trampoline"] = (lambda: (
    lambda g: (rect(g, 1, 10, 14, 14, GREEN), rect(g, 2, 11, 13, 13, ACID),
               rect(g, 0, 14, 2, 15, DARK), rect(g, 13, 14, 15, 15, DARK),
               rect(g, 6, 3, 9, 9, WHITE),
               [rect(g, 4+i, 3-i, 11-i, 3-i, WHITE) for i in range(4)], g)[-1])(blank()))()
GLYPHS["vaporise"] = (lambda: (
    lambda g: (rect(g, 0, 11, 7, 15, BLUE), rect(g, 8, 11, 15, 15, HOT),
               rect(g, 0, 11, 7, 11, COLD), rect(g, 8, 11, 15, 11, GLOW),
               [disc(g, 3+i*4, 7, 2, WHITE) for i in range(3)],
               [disc(g, 5+i*5, 3, 2, SNOW) for i in range(2)], g)[-1])(blank()))()

if __name__ == "__main__":
    art = Path(__file__).parent / "src/main/resources/assets/orbital/textures/item"
    for name, pixels in sorted(GLYPHS.items()):
        assert len(pixels) == 16 and all(len(r) == 16 for r in pixels), name
        filled = sum(1 for row in pixels for p in row if p[3])
        assert filled > 20, f"{name} is nearly empty ({filled} pixels)"
        write_png(art / f"{name}.png", pixels)
        print(f"wrote {name}.png ({filled}/256)")
