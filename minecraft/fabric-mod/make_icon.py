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


if __name__ == "__main__":
    art = Path(__file__).parent / "src/main/resources/assets/orbital/textures/item"
    for name, pixels in (("orbital_laser", PIXELS), ("rewind_clock", CLOCK)):
        out = art / f"{name}.png"
        assert all(len(row) == 16 for row in pixels), f"{name} is not 16 wide"
        assert len(pixels) == 16, f"{name} is not 16 tall"
        write_png(out, pixels)
        print(f"wrote {out.name} ({out.stat().st_size} bytes)")
