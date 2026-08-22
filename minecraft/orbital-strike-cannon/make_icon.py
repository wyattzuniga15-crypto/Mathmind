#!/usr/bin/env python3
"""Generate the 16x16 item icon for the Orbital Strike Cannon.

Pure-stdlib PNG writer so it runs anywhere (no Pillow needed).
The art is a handheld orbital designator: dark gunmetal body, glowing
red targeting lens, orange energy vents.
"""
import struct
import zlib
from pathlib import Path

# Palette
_ = (0, 0, 0, 0)          # transparent
K = (26, 26, 30, 255)     # near-black outline
D = (58, 60, 68, 255)     # dark gunmetal
G = (96, 100, 110, 255)   # gunmetal
L = (140, 145, 155, 255)  # light steel highlight
R = (220, 40, 30, 255)    # red lens
r = (255, 110, 60, 255)   # orange glow
Y = (255, 210, 90, 255)   # energy core
W = (255, 255, 255, 255)  # specular dot

PIXELS = [
    [_, _, _, _, _, K, K, K, K, K, _, _, _, _, _, _],
    [_, _, _, _, K, R, r, r, r, R, K, _, _, _, _, _],
    [_, _, _, K, R, r, Y, W, Y, r, R, K, _, _, _, _],
    [_, _, _, K, R, Y, W, W, W, Y, R, K, _, _, _, _],
    [_, _, _, K, R, r, Y, W, Y, r, R, K, _, _, _, _],
    [_, _, _, _, K, R, r, r, r, R, K, _, _, _, _, _],
    [_, _, _, _, K, G, L, L, L, G, K, _, _, _, _, _],
    [_, _, _, K, D, G, L, L, L, G, D, K, _, _, _, _],
    [_, _, _, K, D, r, G, G, G, r, D, K, _, _, _, _],
    [_, _, _, K, D, G, G, G, G, G, D, K, _, _, _, _],
    [_, _, _, K, D, r, G, G, G, r, D, K, _, _, _, _],
    [_, _, _, _, K, D, G, G, G, D, K, _, _, _, _, _],
    [_, _, _, _, _, K, D, D, D, K, _, _, _, _, _, _],
    [_, _, _, _, _, K, D, K, D, K, _, _, _, _, _, _],
    [_, _, _, _, K, D, D, K, D, D, K, _, _, _, _, _],
    [_, _, _, _, K, K, K, _, K, K, K, _, _, _, _, _],
]


def write_png(path: Path, pixels) -> None:
    height = len(pixels)
    width = len(pixels[0])
    raw = b"".join(
        b"\x00" + b"".join(bytes(px) for px in row) for row in pixels
    )

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


# --- Falling shell entity texture -------------------------------------------
# Box-UV sheet for a 16x16x16 cube on a 64x32 atlas:
#   (16,0)-(32,16)  bottom face
#   (32,0)-(48,16)  top face
#   (0,16)-(64,32)  the four sides, left to right
TNT_RED = (168, 45, 38, 255)
TNT_RED_DARK = (146, 36, 30, 255)
TNT_RED_LIGHT = (188, 57, 47, 255)
BAND = (223, 223, 219, 255)
BAND_SHADE = (198, 198, 194, 255)
LETTER = (62, 62, 66, 255)
TOP = (152, 62, 50, 255)
TOP_DARK = (112, 44, 36, 255)
FUSE = (218, 200, 150, 255)
BOTTOM = (96, 62, 48, 255)
BOTTOM_DARK = (80, 51, 40, 255)

# 4x4 glyphs for the letters stencilled on the side of the block. The N needs
# the full four columns, or its diagonal collapses and it reads as an H.
GLYPHS = {
    "T": [(0, 0), (1, 0), (2, 0), (3, 0),
          (1, 1), (2, 1), (1, 2), (2, 2), (1, 3), (2, 3)],
    "N": [(0, 0), (3, 0), (0, 1), (1, 1), (3, 1),
          (0, 2), (2, 2), (3, 2), (0, 3), (3, 3)],
}


def _speckle(x, y, base, dark, light):
    """Deterministic two-tone noise so the faces aren't flat color."""
    h = (x * 73856093) ^ (y * 19349663)
    h = (h >> 4) & 7
    if h == 0:
        return dark
    if h == 1:
        return light
    return base


def side_tile():
    tile = []
    for y in range(16):
        row = []
        for x in range(16):
            if 5 <= y <= 10:
                row.append(BAND if (x + y) % 7 else BAND_SHADE)
            else:
                row.append(_speckle(x, y, TNT_RED, TNT_RED_DARK, TNT_RED_LIGHT))
        tile.append(row)
    # Stencil "TNT" across the white band, letters 4x4 starting at row 6.
    for index, letter in enumerate("TNT"):
        origin_x = 1 + index * 5
        for gx, gy in GLYPHS[letter]:
            tile[6 + gy][origin_x + gx] = LETTER
    return tile


def top_tile():
    tile = []
    for y in range(16):
        row = []
        for x in range(16):
            # Darker disc in the middle where the fuse comes out.
            if (x - 7.5) ** 2 + (y - 7.5) ** 2 < 16:
                row.append(TOP_DARK)
            else:
                row.append(_speckle(x, y, TOP, TOP_DARK, TNT_RED_LIGHT))
        tile.append(row)
    for x, y in ((7, 7), (8, 7), (7, 8), (8, 8)):
        tile[y][x] = FUSE
    return tile


def bottom_tile():
    return [
        [_speckle(x, y, BOTTOM, BOTTOM_DARK, TOP_DARK) for x in range(16)]
        for y in range(16)
    ]


def shell_texture():
    """Assemble the 64x32 box-UV sheet."""
    sheet = [[(0, 0, 0, 0)] * 64 for _ in range(32)]

    def blit(tile, at_x, at_y):
        for y, row in enumerate(tile):
            for x, px in enumerate(row):
                sheet[at_y + y][at_x + x] = px

    blit(bottom_tile(), 16, 0)
    blit(top_tile(), 32, 0)
    side = side_tile()
    for i in range(4):
        blit(side, i * 16, 16)
    return sheet


if __name__ == "__main__":
    root = Path(__file__).parent
    out = root / "RP" / "textures" / "items" / "orbital_strike_cannon.png"
    write_png(out, PIXELS)
    print(f"wrote {out}")
    # Pack icons shown in the in-game pack list.
    write_png(root / "BP" / "pack_icon.png", PIXELS)
    write_png(root / "RP" / "pack_icon.png", PIXELS)
    print("wrote pack icons")
    shell = root / "RP" / "textures" / "entity" / "sky_tnt.png"
    write_png(shell, shell_texture())
    print(f"wrote {shell}")
