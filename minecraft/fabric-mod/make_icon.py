#!/usr/bin/env python3
"""Generate the 16x16 item icons this mod adds.

Pure-stdlib PNG writer, no Pillow — the same approach as the Bedrock pack's
make_icon.py, which is where the other four icons in this mod came from.

The art is an orbital emitter seen head-on: gunmetal housing, a white-hot
aperture, and the beam flaring out toward the bottom of the frame.
"""
import struct
import zlib
from pathlib import Path

_ = (0, 0, 0, 0)          # transparent
K = (26, 26, 30, 255)     # near-black outline
D = (58, 60, 68, 255)     # dark gunmetal
G = (96, 100, 110, 255)   # gunmetal
L = (140, 145, 155, 255)  # light steel highlight
B = (30, 90, 160, 255)    # deep blue beam edge
C = (60, 200, 235, 255)   # cyan
c = (140, 235, 255, 255)  # bright cyan
W = (255, 255, 255, 255)  # white-hot core

PIXELS = [
    [_, _, _, K, K, K, K, K, K, K, K, K, K, _, _, _],
    [_, _, _, K, D, G, L, L, L, L, G, D, K, _, _, _],
    [_, _, _, K, D, G, L, W, W, L, G, D, K, _, _, _],
    [_, _, _, K, D, B, C, c, c, C, B, D, K, _, _, _],
    [_, _, _, K, B, C, c, W, W, c, C, B, K, _, _, _],
    [_, _, _, _, K, B, C, c, c, C, B, K, _, _, _, _],
    [_, _, _, _, _, K, C, c, c, C, K, _, _, _, _, _],
    [_, _, _, _, _, K, C, W, W, C, K, _, _, _, _, _],
    [_, _, _, _, _, _, C, W, W, C, _, _, _, _, _, _],
    [_, _, _, _, _, _, C, W, W, C, _, _, _, _, _, _],
    [_, _, _, _, _, B, C, W, W, C, B, _, _, _, _, _],
    [_, _, _, _, _, B, C, W, W, C, B, _, _, _, _, _],
    [_, _, _, _, B, C, c, W, W, c, C, B, _, _, _, _],
    [_, _, _, B, C, c, W, W, W, W, c, C, B, _, _, _],
    [_, _, B, C, c, W, W, W, W, W, W, c, C, B, _, _],
    [_, B, C, c, c, W, W, W, W, W, W, c, c, C, B, _],
]


def write_png(path: Path, pixels) -> None:
    height = len(pixels)
    width = len(pixels[0])
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("4B", *px) for px in row)
        for row in pixels
    )

    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)





# --- Rewind Clock -----------------------------------------------------------
# A clock face with the hands running backwards and a streak of cyan motion
# coming off the top left, so it reads as "undo" and not as a vanilla clock.

g = (222, 178, 60, 255)   # gold rim
P = (232, 232, 220, 255)  # pale face
d = (40, 40, 46, 255)     # hub

CLOCK = [
    [_, _, _, C, C, K, K, K, K, K, K, _, _, _, _, _],
    [_, C, c, K, K, g, g, g, g, g, g, K, K, _, _, _],
    [_, C, K, g, g, P, P, P, P, P, P, g, g, K, _, _],
    [C, K, g, P, P, P, P, K, P, P, P, P, P, g, K, _],
    [_, K, g, P, P, P, P, K, P, P, P, P, P, g, K, _],
    [K, g, P, P, P, P, P, K, P, P, P, P, P, P, g, K],
    [K, g, P, P, P, P, P, K, P, P, P, P, P, P, g, K],
    [K, g, P, K, K, K, K, d, P, P, P, P, P, P, g, K],
    [K, g, P, P, P, P, P, P, P, P, P, P, P, P, g, K],
    [K, g, P, P, P, P, P, P, P, P, P, P, P, P, g, K],
    [_, K, g, P, P, P, P, P, P, P, P, P, P, g, K, _],
    [_, K, g, P, P, P, P, P, P, P, P, P, P, g, K, _],
    [_, _, K, g, g, P, P, P, P, P, P, g, g, K, _, _],
    [_, _, _, K, K, g, g, g, g, g, g, K, K, _, _, _],
    [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

# Potato Bomb: a fat brown potato belted with a metal band, fuse lit.
_t = (0, 0, 0, 0)          # transparent
_o = (52, 34, 18, 255)     # outline
_1 = (140, 96, 52, 255)    # skin, shadowed
_2 = (178, 128, 72, 255)   # skin
_3 = (208, 160, 100, 255)  # skin, lit
_e = (92, 62, 34, 255)     # the eyes of the potato
_m = (70, 72, 80, 255)     # metal band
_h = (120, 124, 134, 255)  # band highlight
_f = (196, 190, 170, 255)  # fuse cord
_Y = (255, 214, 90, 255)   # spark
_R = (255, 132, 40, 255)   # spark, hot

POTATO = [
    [_t, _t, _t, _t, _t, _t, _t, _t, _t, _t, _t, _R, _Y, _t, _t, _t],
    [_t, _t, _t, _t, _t, _t, _t, _t, _t, _t, _Y, _R, _Y, _R, _t, _t],
    [_t, _t, _t, _t, _t, _t, _t, _t, _t, _f, _Y, _t, _R, _t, _t, _t],
    [_t, _t, _t, _t, _t, _t, _t, _t, _f, _t, _t, _t, _t, _t, _t, _t],
    [_t, _t, _t, _o, _o, _o, _o, _f, _o, _o, _t, _t, _t, _t, _t, _t],
    [_t, _t, _o, _2, _3, _3, _2, _2, _1, _1, _o, _t, _t, _t, _t, _t],
    [_t, _o, _2, _3, _3, _e, _2, _2, _2, _1, _1, _o, _t, _t, _t, _t],
    [_o, _1, _m, _m, _m, _m, _m, _m, _m, _m, _m, _m, _o, _t, _t, _t],
    [_o, _1, _h, _h, _m, _m, _h, _h, _m, _m, _h, _m, _1, _o, _t, _t],
    [_o, _2, _3, _2, _2, _2, _2, _e, _2, _1, _1, _1, _1, _o, _t, _t],
    [_o, _2, _3, _3, _2, _e, _2, _2, _2, _2, _1, _1, _1, _o, _t, _t],
    [_o, _1, _2, _2, _2, _2, _2, _2, _2, _1, _1, _1, _o, _t, _t, _t],
    [_t, _o, _1, _1, _2, _2, _2, _1, _1, _1, _1, _o, _t, _t, _t, _t],
    [_t, _t, _o, _o, _1, _1, _1, _1, _1, _o, _o, _t, _t, _t, _t, _t],
    [_t, _t, _t, _t, _o, _o, _o, _o, _o, _t, _t, _t, _t, _t, _t, _t],
    [_t, _t, _t, _t, _t, _t, _t, _t, _t, _t, _t, _t, _t, _t, _t, _t],
]

# The two time clocks share the Rewind Clock's shape, recoloured. They are a
# set — three clocks in an inventory need to read as siblings at 16 pixels,
# and re-drawing the dial three times would only make them drift apart.
def recolour(art, swaps):
    return [[swaps.get(px, px) for px in row] for row in art]


# Time Stop: frozen pale blue, the metal gone to ice.
STOP_CLOCK = recolour(CLOCK, {
    P: (206, 238, 252, 255),   # face, frost white
    g: (108, 170, 208, 255),   # rim, cold steel
    C: (150, 220, 250, 255),   # glint
    c: (216, 246, 255, 255),
    d: (24, 60, 96, 255),      # hands, deep ice
})

# Slow Motion: amber, like everything is moving through syrup.
SLOW_CLOCK = recolour(CLOCK, {
    P: (250, 226, 160, 255),   # face, warm amber
    g: (176, 122, 44, 255),    # rim, old brass
    C: (255, 214, 120, 255),   # glint
    c: (255, 244, 200, 255),
    d: (92, 54, 12, 255),      # hands, dark brass
})

# Echo Ghost: a hooded figure fading out toward its trailing edge, so the
# silhouette reads as something half-there rather than a solid mob.
v = (0, 0, 0, 0)
G1 = (86, 62, 128, 110)    # trailing wisp, barely there
G2 = (128, 100, 176, 170)  # body, translucent
G3 = (172, 148, 216, 220)  # body, denser
G4 = (214, 200, 244, 255)  # highlight
GE = (58, 232, 220, 255)   # the eyes
GK = (44, 30, 72, 255)     # dark edge

GHOST = [
    [v, v, v, v, v, GK, GK, GK, GK, GK, v, v, v, v, v, v],
    [v, v, v, v, GK, G3, G3, G3, G3, G3, GK, v, v, v, v, v],
    [v, v, v, GK, G3, G4, G4, G3, G3, G3, G3, GK, v, v, v, v],
    [v, v, v, GK, G3, G4, G3, G3, G3, G3, G3, GK, v, v, v, v],
    [v, v, GK, G3, G3, G3, G3, G3, G3, G3, G3, G3, GK, v, v, v],
    [v, v, GK, G3, GE, GE, G3, G3, GE, GE, G3, G3, GK, v, v, v],
    [v, v, GK, G3, GE, GE, G3, G3, GE, GE, G3, G3, GK, v, v, v],
    [v, v, GK, G3, G3, G3, G3, G3, G3, G3, G3, G3, GK, v, v, v],
    [v, GK, G2, G3, G3, G3, G3, G3, G3, G3, G3, G3, G2, GK, v, v],
    [v, GK, G2, G2, G3, G3, G3, G3, G3, G3, G3, G2, G2, GK, v, v],
    [v, GK, G2, G2, G2, G2, G3, G3, G2, G2, G2, G2, G2, GK, v, v],
    [v, GK, G1, G2, G2, G2, G2, G2, G2, G2, G2, G2, G1, GK, v, v],
    [v, GK, G1, G1, G2, G2, G2, G2, G2, G2, G2, G1, G1, GK, v, v],
    [v, v, GK, G1, G1, G1, G2, G2, G1, G1, G1, G1, GK, v, v, v],
    [v, v, v, GK, G1, v, GK, G1, G1, v, GK, GK, v, v, v, v],
    [v, v, v, v, GK, v, v, GK, GK, v, v, v, v, v, v, v],
]

# Echo Beacon: a dark plinth with a ghost-light rising out of it, so the pair
# read as related without being the same picture twice.
B1 = (46, 34, 70, 255)     # plinth, shadow
B2 = (74, 58, 108, 255)    # plinth
B3 = (108, 90, 150, 255)   # plinth, lit edge
BL = (58, 232, 220, 255)   # beam
BW = (206, 255, 250, 255)  # beam core

BEACON = [
    [v, v, v, v, v, v, BL, BW, BW, BL, v, v, v, v, v, v],
    [v, v, v, v, v, v, BL, BW, BW, BL, v, v, v, v, v, v],
    [v, v, v, v, v, v, v, BL, BL, v, v, v, v, v, v, v],
    [v, v, v, v, v, G1, v, BL, BL, v, G1, v, v, v, v, v],
    [v, v, v, v, G1, G2, v, BL, BL, v, G2, G1, v, v, v, v],
    [v, v, v, v, G2, G3, GK, BL, BL, GK, G3, G2, v, v, v, v],
    [v, v, v, v, G1, G2, v, BW, BW, v, G2, G1, v, v, v, v],
    [v, v, v, v, v, G1, v, BW, BW, v, G1, v, v, v, v, v],
    [v, v, v, GK, GK, GK, GK, BW, BW, GK, GK, GK, GK, v, v, v],
    [v, v, GK, B3, B3, B3, B3, BW, BW, B3, B3, B3, B3, GK, v, v],
    [v, v, GK, B3, B2, B2, B2, BL, BL, B2, B2, B2, B3, GK, v, v],
    [v, v, GK, B2, B2, B1, B1, B1, B1, B1, B1, B2, B2, GK, v, v],
    [v, GK, B3, B2, B2, B1, B1, B1, B1, B1, B1, B2, B2, B3, GK, v],
    [v, GK, B2, B1, B1, B1, B1, B1, B1, B1, B1, B1, B1, B2, GK, v],
    [v, GK, B1, B1, B1, B1, B1, B1, B1, B1, B1, B1, B1, B1, GK, v],
    [v, v, GK, GK, GK, GK, GK, GK, GK, GK, GK, GK, GK, GK, v, v],
]

# Fast Forward: hot orange, the dial running away with itself.
FAST_CLOCK = recolour(CLOCK, {
    P: (255, 214, 150, 255),   # face, hot
    g: (196, 92, 24, 255),     # rim, fired copper
    C: (255, 176, 80, 255),
    c: (255, 236, 196, 255),
    d: (110, 34, 4, 255),      # hands
})

# Ore Sense: a dowsing lens over a seam of ore, colours matching the particles
# the pulse actually draws so the icon reads as a legend for it.
o_ = (0, 0, 0, 0)
oK = (32, 30, 40, 255)     # outline
oS = (86, 88, 100, 255)    # stone
oS2 = (116, 118, 132, 255) # stone, lit
oD = (110, 240, 230, 255)  # diamond
oE = (86, 220, 110, 255)   # emerald
oG = (250, 200, 70, 255)   # gold
oR = (232, 78, 78, 255)    # redstone
oL = (200, 240, 255, 140)  # lens glass
oB = (176, 182, 196, 255)  # lens rim

ORE = [
    [o_, o_, o_, oK, oK, oK, oK, oK, oK, o_, o_, o_, o_, o_, o_, o_],
    [o_, o_, oK, oS, oS2, oS, oS, oS2, oS, oK, o_, o_, o_, o_, o_, o_],
    [o_, oK, oS, oS2, oD, oD, oS, oS, oS2, oS, oK, o_, o_, o_, o_, o_],
    [o_, oK, oS, oS, oD, oD, oS, oE, oE, oS, oS, oK, o_, o_, o_, o_],
    [oK, oS, oS2, oS, oS, oS, oS, oE, oE, oS, oS2, oS, oK, o_, o_, o_],
    [oK, oS, oS, oB, oB, oB, oB, oS, oS, oS, oS, oS, oK, o_, o_, o_],
    [oK, oS2, oB, oL, oL, oL, oL, oB, oS, oG, oG, oS, oK, o_, o_, o_],
    [oK, oS, oB, oL, oD, oD, oL, oB, oS, oG, oG, oS2, oK, o_, o_, o_],
    [oK, oS, oB, oL, oD, oD, oL, oB, oS, oS, oS, oS, oK, o_, o_, o_],
    [oK, oS, oB, oL, oL, oL, oL, oB, oS2, oS, oS, oS, oK, o_, o_, o_],
    [oK, oS2, oS, oB, oB, oB, oB, oB, oS, oS, oR, oS, oK, o_, o_, o_],
    [o_, oK, oS, oS, oS, oS, oS, oB, oB, oS, oR, oS, oK, o_, o_, o_],
    [o_, oK, oS, oR, oS, oS, oS, oS, oB, oB, oS, oS, oK, o_, o_, o_],
    [o_, o_, oK, oR, oS, oS, oS, oS, oS, oB, oB, oK, o_, o_, o_, o_],
    [o_, o_, o_, oK, oK, oS, oS, oS, oK, oK, oB, oB, o_, o_, o_, o_],
    [o_, o_, o_, o_, o_, oK, oK, oK, o_, o_, o_, oB, o_, o_, o_, o_],
]

# Bottled Chunk: a glass flask with a cube of world floating inside it.
b_ = (0, 0, 0, 0)
bK = (36, 44, 56, 255)      # outline
bG = (150, 196, 214, 190)   # glass
bH = (216, 240, 248, 220)   # glass highlight
bC = (128, 88, 52, 255)     # cork
bD = (96, 72, 46, 255)      # dirt in the cube
bV = (96, 168, 74, 255)     # grass top
bT = (120, 122, 126, 255)   # stone in the cube

BOTTLE = [
    [b_, b_, b_, b_, b_, b_, bK, bK, bK, b_, b_, b_, b_, b_, b_, b_],
    [b_, b_, b_, b_, b_, bK, bC, bC, bC, bK, b_, b_, b_, b_, b_, b_],
    [b_, b_, b_, b_, b_, bK, bC, bC, bC, bK, b_, b_, b_, b_, b_, b_],
    [b_, b_, b_, b_, b_, bK, bG, bH, bG, bK, b_, b_, b_, b_, b_, b_],
    [b_, b_, b_, b_, bK, bG, bG, bH, bG, bG, bK, b_, b_, b_, b_, b_],
    [b_, b_, b_, bK, bG, bG, bH, bG, bG, bG, bG, bK, b_, b_, b_, b_],
    [b_, b_, bK, bG, bH, bG, bG, bG, bG, bG, bG, bG, bK, b_, b_, b_],
    [b_, bK, bG, bH, bG, bV, bV, bV, bV, bG, bG, bG, bG, bK, b_, b_],
    [b_, bK, bG, bH, bG, bD, bD, bD, bD, bG, bG, bG, bG, bK, b_, b_],
    [b_, bK, bG, bG, bG, bD, bD, bD, bD, bG, bG, bG, bG, bK, b_, b_],
    [b_, bK, bG, bG, bG, bT, bT, bT, bT, bG, bG, bG, bG, bK, b_, b_],
    [b_, bK, bG, bG, bG, bG, bG, bG, bG, bG, bG, bG, bG, bK, b_, b_],
    [b_, bK, bG, bG, bG, bG, bG, bG, bG, bG, bG, bG, bG, bK, b_, b_],
    [b_, b_, bK, bG, bG, bG, bG, bG, bG, bG, bG, bG, bK, b_, b_, b_],
    [b_, b_, b_, bK, bK, bG, bG, bG, bG, bG, bK, bK, b_, b_, b_, b_],
    [b_, b_, b_, b_, b_, bK, bK, bK, bK, bK, b_, b_, b_, b_, b_, b_],
]

# Portal Gun: a white shell with a blue aperture and an orange one, the two
# colours the portals themselves are drawn in.
p_ = (0, 0, 0, 0)
pK = (40, 42, 50, 255)      # outline
pW = (232, 234, 240, 255)   # shell
pS = (176, 180, 192, 255)   # shell shadow
pH = (255, 255, 255, 255)   # shell highlight
pD = (86, 90, 104, 255)     # dark housing
pB = (72, 160, 255, 255)    # blue aperture
pb = (188, 226, 255, 255)   # blue core
pO = (255, 148, 40, 255)    # orange aperture
po = (255, 214, 150, 255)   # orange core

GUN = [
    [p_, p_, p_, p_, p_, p_, pK, pK, pK, pK, p_, p_, p_, p_, p_, p_],
    [p_, p_, p_, p_, p_, pK, pW, pH, pH, pW, pK, p_, p_, p_, p_, p_],
    [p_, p_, p_, p_, pK, pW, pB, pb, pb, pB, pW, pK, p_, p_, p_, p_],
    [p_, p_, p_, pK, pW, pB, pb, pB, pB, pb, pB, pW, pK, p_, p_, p_],
    [p_, p_, p_, pK, pW, pB, pB, pD, pD, pB, pB, pW, pK, p_, p_, p_],
    [p_, p_, p_, pK, pW, pW, pD, pD, pD, pD, pW, pW, pK, p_, p_, p_],
    [p_, p_, p_, pK, pW, pO, pO, pD, pD, pO, pO, pW, pK, p_, p_, p_],
    [p_, p_, p_, pK, pW, pO, po, pO, pO, po, pO, pW, pK, p_, p_, p_],
    [p_, p_, p_, p_, pK, pW, pO, po, po, pO, pW, pK, p_, p_, p_, p_],
    [p_, p_, p_, p_, pK, pS, pW, pW, pW, pW, pS, pK, p_, p_, p_, p_],
    [p_, p_, p_, p_, p_, pK, pS, pW, pW, pS, pK, p_, p_, p_, p_, p_],
    [p_, p_, p_, p_, p_, pK, pD, pS, pS, pD, pK, p_, p_, p_, p_, p_],
    [p_, p_, p_, p_, pK, pD, pD, pS, pS, pD, pD, pK, p_, p_, p_, p_],
    [p_, p_, p_, pK, pD, pD, pK, pS, pS, pK, pD, pD, pK, p_, p_, p_],
    [p_, p_, p_, pK, pD, pK, p_, pK, pK, p_, pK, pD, pK, p_, p_, p_],
    [p_, p_, p_, p_, pK, p_, p_, p_, p_, p_, p_, pK, p_, p_, p_, p_],
]

# Chronarch Seal: a cracked purple sigil disc — a thing you break to wake
# something. Deliberately not clock-shaped: it summons the boss, it does not
# manipulate time, and four clocks in one inventory is three too many.
z_ = (0, 0, 0, 0)
zK = (28, 18, 42, 255)      # outline
zS = (74, 44, 108, 255)     # stone, shadow
zM = (108, 70, 150, 255)    # stone
zL = (146, 108, 196, 255)   # stone, lit
zG = (216, 150, 255, 255)   # glyph glow
zC = (255, 232, 255, 255)   # glyph core

SEAL = [
    [z_, z_, z_, z_, z_, zK, zK, zK, zK, zK, zK, z_, z_, z_, z_, z_],
    [z_, z_, z_, zK, zK, zM, zL, zL, zL, zL, zM, zK, zK, z_, z_, z_],
    [z_, z_, zK, zM, zL, zL, zM, zG, zG, zM, zL, zL, zM, zK, z_, z_],
    [z_, zK, zM, zL, zM, zG, zG, zC, zC, zG, zG, zM, zL, zM, zK, z_],
    [z_, zK, zL, zM, zG, zC, zM, zG, zG, zM, zC, zG, zM, zL, zK, z_],
    [zK, zM, zL, zG, zC, zM, zM, zK, zK, zM, zM, zC, zG, zL, zM, zK],
    [zK, zM, zM, zG, zM, zM, zK, zS, zS, zK, zM, zM, zG, zM, zM, zK],
    [zK, zL, zG, zC, zG, zK, zS, zS, zS, zS, zK, zG, zC, zG, zL, zK],
    [zK, zL, zG, zC, zG, zK, zS, zS, zS, zS, zK, zG, zC, zG, zL, zK],
    [zK, zM, zM, zG, zM, zM, zK, zS, zS, zK, zM, zM, zG, zM, zM, zK],
    [zK, zM, zL, zG, zC, zM, zM, zK, zK, zM, zM, zC, zG, zL, zM, zK],
    [z_, zK, zL, zM, zG, zC, zM, zG, zG, zM, zC, zG, zM, zL, zK, z_],
    [z_, zK, zM, zL, zM, zG, zG, zC, zC, zG, zG, zM, zL, zM, zK, z_],
    [z_, z_, zK, zM, zL, zL, zM, zG, zG, zM, zL, zL, zM, zK, z_, z_],
    [z_, z_, z_, zK, zK, zM, zL, zL, zL, zL, zM, zK, zK, z_, z_, z_],
    [z_, z_, z_, z_, z_, zK, zK, zK, zK, zK, zK, z_, z_, z_, z_, z_],
]

# Chronarch's Heart: a beating violet core caged in dark metal, still ticking.
h_ = (0, 0, 0, 0)
hK = (30, 20, 40, 255)      # outline
hC = (58, 46, 74, 255)      # cage
hc = (96, 82, 118, 255)     # cage, lit
hD = (128, 40, 150, 255)    # heart, deep
hM = (188, 76, 210, 255)    # heart
hL = (232, 140, 250, 255)   # heart, lit
hW = (255, 226, 255, 255)   # core

HEART = [
    [h_, h_, h_, hK, hK, h_, h_, h_, h_, hK, hK, h_, h_, h_, h_, h_],
    [h_, h_, hK, hc, hC, hK, h_, h_, hK, hC, hc, hK, h_, h_, h_, h_],
    [h_, hK, hC, hD, hM, hD, hK, hK, hD, hM, hD, hC, hK, h_, h_, h_],
    [hK, hC, hD, hM, hL, hM, hD, hD, hM, hL, hM, hD, hC, hK, h_, h_],
    [hK, hc, hM, hL, hW, hL, hM, hM, hL, hW, hL, hM, hc, hK, h_, h_],
    [hK, hC, hM, hL, hL, hM, hM, hM, hM, hL, hL, hM, hC, hK, h_, h_],
    [hK, hC, hD, hM, hM, hM, hW, hW, hM, hM, hM, hD, hC, hK, h_, h_],
    [h_, hK, hD, hM, hM, hM, hW, hW, hM, hM, hM, hD, hK, h_, h_, h_],
    [h_, hK, hC, hD, hM, hM, hM, hM, hM, hM, hD, hC, hK, h_, h_, h_],
    [h_, h_, hK, hC, hD, hM, hM, hM, hM, hD, hC, hK, h_, h_, h_, h_],
    [h_, h_, hK, hc, hC, hD, hM, hM, hD, hC, hc, hK, h_, h_, h_, h_],
    [h_, h_, h_, hK, hC, hC, hD, hD, hC, hC, hK, h_, h_, h_, h_, h_],
    [h_, h_, h_, h_, hK, hC, hC, hC, hC, hK, h_, h_, h_, h_, h_, h_],
    [h_, h_, h_, h_, h_, hK, hC, hC, hK, h_, h_, h_, h_, h_, h_, h_],
    [h_, h_, h_, h_, h_, h_, hK, hK, h_, h_, h_, h_, h_, h_, h_, h_],
    [h_, h_, h_, h_, h_, h_, h_, h_, h_, h_, h_, h_, h_, h_, h_, h_],
]

# The four rewind clocks: the same dial, deepening in colour with reach, so a
# glance at the hotbar says how far each one goes. Reading them as a family
# matters more than four unrelated pictures would.
DEEP_REWIND = recolour(CLOCK, {
    P: (198, 214, 250, 255),   # face
    g: (72, 96, 152, 255),     # rim
    C: (150, 178, 240, 255),
    c: (222, 234, 255, 255),
    d: (22, 34, 78, 255),      # hands
})

LONG_REWIND = recolour(CLOCK, {
    P: (206, 190, 246, 255),
    g: (96, 66, 156, 255),
    C: (176, 148, 240, 255),
    c: (232, 222, 255, 255),
    d: (38, 18, 74, 255),
})

# Genesis reaches as far as anything is kept, so it is the odd one: near-black
# stone with a white dial, the only one that does not read as a colour.
GENESIS = recolour(CLOCK, {
    P: (238, 236, 244, 255),
    g: (34, 32, 42, 255),
    C: (250, 248, 255, 255),
    c: (255, 255, 255, 255),
    d: (12, 10, 18, 255),
})


# The Cat Bazooka: a launch tube seen from behind and to the left, with the
# cat already nose-out at the muzzle. Sixteen pixels is not enough room for
# both a whole cat and a whole weapon, so the tube is only implied — the back
# blast at the bottom-left is what says "launcher" rather than "pet".
_bo = (30, 26, 24, 255)     # outline, everything
_bg = (74, 82, 70, 255)     # tube, shadowed
_bG = (118, 128, 110, 255)  # tube, lit
_bO = (232, 138, 46, 255)   # cat, orange
_bW = (248, 244, 236, 255)  # cat, muzzle
_bK = (24, 20, 18, 255)     # eyes and ear tips
_bP = (240, 150, 168, 255)  # nose
_bY = (255, 206, 92, 255)   # back blast

_BAZOOKA_ART = [
    "..........K...K.",
    ".........KOK.KOK",
    ".........OOOOOOO",
    ".........OKOOOKO",
    "........OOOOOOOO",
    "........OOWWPWWO",
    "........OOWWWWWO",
    ".......ooOOOOOOo",
    "......ogGGgo.oo.",
    ".....ogGGgo.....",
    "....ogGGgo......",
    "...ogGGgo.......",
    "..ogGGgo........",
    ".oGGGgo.........",
    "YoGGGoY.........",
    ".YYoYY..........",
]

_BAZOOKA_KEY = {
    ".": _t, "o": _bo, "g": _bg, "G": _bG,
    "O": _bO, "W": _bW, "K": _bK, "P": _bP, "Y": _bY,
}

BAZOOKA = [[_BAZOOKA_KEY[c] for c in row] for row in _BAZOOKA_ART]


# The Growing Cat: a kitten's face with sparkles at the corners. The item is
# about change over time, which a single frame cannot show — so the sparkles
# carry it, the same shorthand an enchantment glint uses.
_go = (36, 24, 16, 255)     # outline
_gO = (236, 146, 52, 255)   # fur
_gW = (250, 246, 238, 255)  # muzzle
_gK = (26, 20, 18, 255)     # ear tips
_gE = (60, 200, 160, 255)   # eyes
_gP = (244, 154, 172, 255)  # nose
_gY = (255, 226, 120, 255)  # sparkle

_CAT_ART = [
    "..Y..........Y..",
    "...K........K...",
    "...KO......OK...",
    "...KOO....OOK...",
    "...OOOOOOOOOO...",
    "..OOOOOOOOOOOO..",
    "..OOEOOOOOOEOO..",
    "..OOEOOOOOOEOO..",
    "..OOOOOPPOOOOO..",
    "..OOWWWPPWWWOO..",
    "...OWWWWWWWWO...",
    "...OOWWWWWWOO...",
    "....OOOOOOOO....",
    "..Y...OOOO...Y..",
    "................",
    "................",
]

_CAT_KEY = {
    ".": _t, "O": _gO, "W": _gW, "K": _gK,
    "E": _gE, "P": _gP, "Y": _gY, "o": _go,
}

GROWING_CAT = [[_CAT_KEY[c] for c in row] for row in _CAT_ART]


if __name__ == "__main__":
    art = Path(__file__).parent / "src/main/resources/assets/orbital/textures/item"
    for name, pixels in (("orbital_laser", PIXELS), ("rewind_clock", CLOCK), ("potato_bomb", POTATO),
                          ("cat_bazooka", BAZOOKA),
                          ("growing_cat", GROWING_CAT),
                          ("time_stop_clock", STOP_CLOCK),
                          ("slow_time_clock", SLOW_CLOCK),
                          ("echo_ghost", GHOST),
                          ("echo_beacon", BEACON),
                          ("fast_forward_clock", FAST_CLOCK),
                          ("ore_sense", ORE),
                          ("bottled_chunk", BOTTLE),
                          ("portal_gun", GUN),
                          ("chronarch_seal", SEAL),
                          ("chronarch_heart", HEART),
                          ("deep_rewind_clock", DEEP_REWIND),
                          ("long_rewind_clock", LONG_REWIND),
                          ("genesis_clock", GENESIS)):
        out = art / f"{name}.png"
        assert all(len(row) == 16 for row in pixels), f"{name} is not 16 wide"
        assert len(pixels) == 16, f"{name} is not 16 tall"
        write_png(out, pixels)
        print(f"wrote {out.name} ({out.stat().st_size} bytes)")
