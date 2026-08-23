#!/usr/bin/env python3
"""Generate the Orbital Laser's 16x16 item icon.

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


if __name__ == "__main__":
    out = Path(__file__).parent / "src/main/resources/assets/orbital/textures/item/orbital_laser.png"
    write_png(out, PIXELS)
    print(f"wrote {out} ({out.stat().st_size} bytes)")
