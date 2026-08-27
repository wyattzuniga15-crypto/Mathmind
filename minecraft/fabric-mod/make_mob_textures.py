#!/usr/bin/env python3
"""Paint the entity textures from the same box maths the models use.

A Minecraft entity texture is not a picture — it is six rectangles per cuboid
laid out in a fixed pattern, and getting one rectangle wrong puts the whale's
belly on its face. The Chronarch's crown floated for exactly that reason, and
the fix was to compute the regions rather than place them by eye. Same here.

Each box is declared once with the numbers taken straight out of the model, so
if a cuboid moves the texture follows.
"""
from pathlib import Path
from make_icon import write_png


def canvas(w, h):
    return [[(0, 0, 0, 0)] * w for _ in range(h)]


def fill(img, u, v, w, h, painter, face):
    for y in range(h):
        for x in range(w):
            py, px = v + y, u + x
            if 0 <= py < len(img) and 0 <= px < len(img[0]):
                img[py][px] = painter(x, y, w, h, face)


def box(img, u, v, w, h, d, painter):
    """One cuboid's six faces, in the order Minecraft unwraps them."""
    fill(img, u + d, v, w, d, painter, "top")
    fill(img, u + d + w, v, w, d, painter, "bottom")
    fill(img, u, v + d, d, h, painter, "right")
    fill(img, u + d, v + d, w, h, painter, "front")
    fill(img, u + d + w, v + d, d, h, painter, "left")
    fill(img, u + d + w + d, v + d, w, h, painter, "back")


def regions(u, v, w, h, d):
    """The six rectangles a cuboid claims, for the overlap check."""
    return [(u + d, v, w, d), (u + d + w, v, w, d), (u, v + d, d, h),
            (u + d, v + d, w, h), (u + d + w, v + d, d, h), (u + d + w + d, v + d, w, h)]


def clamp(c):
    return max(0, min(255, int(c)))


def whale(x, y, w, h, face):
    """Slate blue above, pale belly below, with a soft speckle."""
    down = y / max(1, h - 1)
    if face == "bottom":
        r, g, b = 214, 220, 228
    elif face == "top":
        r, g, b = 44, 62, 96
    else:
        # The belly line is the whole read of a whale from the side.
        pale = 1.0 if down > 0.66 else down / 0.66
        r = 44 + (200 - 44) * pale
        g = 62 + (210 - 62) * pale
        b = 96 + (222 - 96) * pale
    speck = ((x * 7 + y * 13) % 23 == 0) * 12
    return (clamp(r + speck), clamp(g + speck), clamp(b + speck), 255)


def titan(x, y, w, h, face):
    """Weathered bronze plate, with rivets along the seams."""
    down = y / max(1, h - 1)
    r, g, b = 148 - 34 * down, 108 - 26 * down, 62 - 16 * down
    # Panel lines every eight units, and a rivet where they cross.
    if x % 8 == 0 or y % 8 == 0:
        r, g, b = r * 0.72, g * 0.72, b * 0.72
    if x % 8 == 0 and y % 8 == 0:
        r, g, b = r * 1.7 + 40, g * 1.7 + 34, b * 1.7 + 20
    if face in ("top", "bottom"):
        r, g, b = r * 0.8, g * 0.8, b * 0.8
    return (clamp(r), clamp(g), clamp(b), 255)


# Numbers lifted straight from the models: (u, v, width, height, depth).
SHEETS = {
    "sky_whale": (256, 192, whale, [
        (0, 0, 80, 34, 30),      # body
        (0, 66, 24, 10, 26),     # jaw
        (0, 104, 26, 18, 14),    # tail
        (0, 138, 18, 2, 44),     # fluke
        (80, 138, 22, 3, 12),    # left fin
        (80, 156, 22, 3, 12),    # right fin
    ]),
    # Laid out by arithmetic, not by eye: a cuboid w x h x d claims
    # (2d + 2w) across and (d + h) down. Placed by hand, the right leg sat
    # four pixels inside the left one — the same class of mistake that once
    # left the Chronarch's crown floating above its head.
    "titan": (256, 128, titan, [
        (0, 0, 32, 34, 20),      # torso
        (106, 0, 14, 14, 14),    # head
        (164, 0, 11, 40, 12),    # left arm
        (0, 56, 11, 40, 12),     # right arm
        (48, 56, 13, 40, 14),    # left leg
        (104, 56, 13, 40, 14),   # right leg
    ]),
}

if __name__ == "__main__":
    out = Path(__file__).parent / "src/main/resources/assets/orbital/textures/entity"
    out.mkdir(parents=True, exist_ok=True)
    for name, (w, h, painter, boxes) in SHEETS.items():
        img = canvas(w, h)
        # Two boxes sharing a pixel means one of them is wearing the other's
        # face. Checked rather than eyeballed, because it is invisible in the
        # sheet and obvious the moment the mob is in front of you.
        claimed = {}
        for spec in boxes:
            for (rx, ry, rw, rh) in regions(*spec):
                for yy in range(ry, ry + rh):
                    for xx in range(rx, rx + rw):
                        assert 0 <= xx < w and 0 <= yy < h, \
                            f"{name}: box {spec} runs off the {w}x{h} sheet at {xx},{yy}"
                        assert (xx, yy) not in claimed, \
                            f"{name}: {spec} overlaps {claimed[(xx, yy)]} at {xx},{yy}"
                        claimed[(xx, yy)] = spec
        for spec in boxes:
            box(img, *spec, painter)
        write_png(out / f"{name}.png", img)
        print(f"wrote {name}.png ({w}x{h}, {len(boxes)} boxes, "
              f"{len(claimed)} pixels claimed, no overlaps)")
