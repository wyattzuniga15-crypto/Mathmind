#!/usr/bin/env python3
"""Paint the Chronarch's entity sheet.

The first version placed texture regions by hand and got the crown wrong,
because a Minecraft cuboid does not occupy the rectangle you might expect: a
box of width w, height h and depth d claims a region 2d+2w across and d+h
tall, with its six faces in a fixed cross layout inside that. Guessing at that
per box is how faces end up blank or wearing each other's paint.

So `box()` computes the six face rectangles from the cuboid's own dimensions
and hands each to a painter. Getting the layout right once means every box is
right, and adding a part later cannot silently break it.
"""
import struct
import zlib
from pathlib import Path

W = H = 128
px = [[(0, 0, 0, 0)] * W for _ in range(H)]


def fill(x0, y0, w, h, painter, face):
    for y in range(h):
        for x in range(w):
            tx, ty = x0 + x, y0 + y
            if 0 <= tx < W and 0 <= ty < H:
                px[ty][tx] = painter(x, y, w, h, face)


def box(u, v, w, h, d, painter):
    """Lay out one cuboid's six faces the way Minecraft reads them."""
    fill(u + d, v, w, d, painter, "top")
    fill(u + d + w, v, w, d, painter, "bottom")
    fill(u, v + d, d, h, painter, "right")
    fill(u + d, v + d, w, h, painter, "front")
    fill(u + d + w, v + d, d, h, painter, "left")
    fill(u + d + w + d, v + d, w, h, painter, "back")


def clamp(c):
    return max(0, min(255, int(c)))


def stone(x, y, w, h, face):
    """Dark violet masonry, courses picked out and a little glow in the seams."""
    t = y / max(1, h - 1)
    r, g, b = 66 - 16 * t, 52 - 12 * t, 92 - 18 * t
    if face in ("top", "bottom"):
        r, g, b = r * 0.8, g * 0.8, b * 0.8
    if y % 7 == 0 or (x + (y // 7) * 4) % 13 == 0:
        r, g, b = r * 0.66, g * 0.66, b * 0.66
    if (x * 5 + y * 3) % 29 == 0:
        r, g, b = r + 70, g + 24, b + 90
    # Bevel the edges so a big flat box still reads as carved.
    if x < 1 or y < 1 or x >= w - 1 or y >= h - 1:
        r, g, b = r * 1.35, g * 1.35, b * 1.4
    return (clamp(r), clamp(g), clamp(b), 255)


def dial(x, y, w, h, face):
    """The front of the body: a clock face, ticks and all."""
    if face != "front":
        return stone(x, y, w, h, face)
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    dx, dy = x - cx, y - cy
    r = (dx * dx + dy * dy) ** 0.5 / (min(w, h) / 2.0)
    if r > 0.94:
        return stone(x, y, w, h, face)
    if r > 0.80:
        # Twelve ticks around the rim.
        import math
        a = (math.atan2(dy, dx) + math.pi) / (math.pi * 2) * 12
        return (238, 214, 255, 255) if abs(a - round(a)) < 0.13 else (46, 34, 66, 255)
    if r > 0.72:
        return (150, 116, 196, 255)
    glow = 128 + 96 * (1.0 - r)
    return (clamp(glow), clamp(glow * 0.40), clamp(glow * 1.06), 255)


def lit(x, y, w, h, face):
    """The crown: something burning inside a stone housing."""
    if face == "top":
        return (214, 255, 250, 255)
    t = 1.0 - (y / max(1, h - 1))
    return (clamp(70 + 150 * t), clamp(210 * t + 40), clamp(200 * t + 60), 255)


def iron(x, y, w, h, face):
    """The waist ring: dark banded metal with rivets."""
    if y % 5 == 2:
        return (150, 140, 168, 255)
    base = (58, 50, 74) if (y % 5) else (40, 34, 54)
    if x % 9 == 4 and y % 5 in (1, 3):
        return (196, 186, 214, 255)
    return (base[0], base[1], base[2], 255)


def brass(x, y, w, h, face):
    return (255, 226, 168, 255)


# ---- the atlas, laid out so no two boxes overlap -------------------------
box(0, 0, 26, 26, 18, dial)      # core body        -> 88 x 44
box(0, 45, 34, 5, 26, iron)      # waist ring       -> 120 x 31
box(0, 77, 16, 8, 12, lit)       # crown            -> 56 x 20
box(58, 77, 10, 12, 18, stone)   # shoulder         -> 56 x 30
box(0, 98, 10, 16, 10, stone)    # leg              -> 40 x 26
box(42, 98, 2, 11, 1, brass)     # long hand        -> 6 x 12
box(50, 98, 2, 7, 1, brass)      # short hand       -> 6 x 8

raw = b"".join(b"\x00" + b"".join(struct.pack("4B", *p) for p in row) for row in px)


def chunk(tag, data):
    body = tag + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))


png = (b"\x89PNG\r\n\x1a\n"
       + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(raw, 9))
       + chunk(b"IEND", b""))

out = Path(__file__).parent / "src/main/resources/assets/orbital/textures/entity/chronarch.png"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(png)
print(f"wrote {out.name} ({W}x{H}, {out.stat().st_size} bytes)")
