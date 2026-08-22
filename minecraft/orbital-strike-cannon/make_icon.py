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


if __name__ == "__main__":
    root = Path(__file__).parent
    out = root / "RP" / "textures" / "items" / "orbital_strike_cannon.png"
    write_png(out, PIXELS)
    print(f"wrote {out}")
    # Pack icons shown in the in-game pack list.
    write_png(root / "BP" / "pack_icon.png", PIXELS)
    write_png(root / "RP" / "pack_icon.png", PIXELS)
    print("wrote pack icons")
