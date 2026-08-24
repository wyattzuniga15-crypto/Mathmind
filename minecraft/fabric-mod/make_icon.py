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


if __name__ == "__main__":
    art = Path(__file__).parent / "src/main/resources/assets/orbital/textures/item"
    for name, pixels in (("orbital_laser", PIXELS), ("rewind_clock", CLOCK), ("potato_bomb", POTATO),
                          ("time_stop_clock", STOP_CLOCK),
                          ("slow_time_clock", SLOW_CLOCK),
                          ("echo_ghost", GHOST),
                          ("echo_beacon", BEACON)):
        out = art / f"{name}.png"
        assert all(len(row) == 16 for row in pixels), f"{name} is not 16 wide"
        assert len(pixels) == 16, f"{name} is not 16 tall"
        write_png(out, pixels)
        print(f"wrote {out.name} ({out.stat().st_size} bytes)")
