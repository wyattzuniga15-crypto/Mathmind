#!/usr/bin/env python3
"""Check the journal's run-length encoding puts a world back exactly.

This mirrors Frame.start/extend and the replay loop in Journal.java. It is a
model rather than the real thing, but the logic it models is the subtlest in
the mod — a run that extends when it should not, or a replay that walks a run
from the wrong end, corrupts the world quietly and only where a player happens
to look. That is worth a test that runs on every build.

Run: python3 test_journal_runs.py
"""
import random
import sys

MAX_RUN = 32767
AXIS_X, AXIS_Y, AXIS_Z = 0, 1, 2


class Frame:
    """Mirrors Journal.Frame."""

    def __init__(self):
        self.runs = []   # [x, y, z, state, length, axis]
        self.blocks = 0

    def record(self, x, y, z, state):
        if not self._extend(x, y, z, state):
            self.runs.append([x, y, z, state, 1, AXIS_Z])
            self.blocks += 1

    def _extend(self, x, y, z, state):
        if not self.runs:
            return False
        run = self.runs[-1]
        ex, ey, ez, was, length, axis = run
        if was != state or length >= MAX_RUN:
            return False
        if length == 1:
            # A run of one has no direction yet, so any neighbour sets it.
            if (x, y, z) == (ex + 1, ey, ez):
                run[5] = AXIS_X
            elif (x, y, z) == (ex, ey + 1, ez):
                run[5] = AXIS_Y
            elif (x, y, z) == (ex, ey, ez + 1):
                run[5] = AXIS_Z
            else:
                return False
        else:
            follows = {
                AXIS_X: (x, y, z) == (ex + length, ey, ez),
                AXIS_Y: (x, y, z) == (ex, ey + length, ez),
                AXIS_Z: (x, y, z) == (ex, ey, ez + length),
            }[axis]
            if not follows:
                return False
        run[4] += 1
        self.blocks += 1
        return True


def replay(frame):
    """Newest run first, each walked from its far end back."""
    out = []
    runs = [list(r) for r in frame.runs]
    while runs:
        run = runs[-1]
        x, y, z, state, length, axis = run
        step = length - 1
        out.append((
            (x + (step if axis == AXIS_X else 0),
             y + (step if axis == AXIS_Y else 0),
             z + (step if axis == AXIS_Z else 0)),
            state,
        ))
        run[4] -= 1
        if run[4] == 0:
            runs.pop()
    return out


def check(name, passed, detail=""):
    print(f"  {'ok  ' if passed else 'FAIL'}  {name}{'  ' + detail if detail else ''}")
    return passed


def main():
    random.seed(7)
    ok = True

    # A noisy world, cleared row by row the way the weapons walk it.
    world = {}
    for x in range(-6, 7):
        for y in range(-3, 4):
            for z in range(-6, 7):
                world[(x, y, z)] = random.choice(
                    ["stone", "stone", "stone", "deepslate", "air"])
    before = dict(world)
    frame = Frame()
    for x in range(-6, 7):
        for y in range(-3, 4):
            for z in range(-6, 7):
                if world[(x, y, z)] != "air":
                    frame.record(x, y, z, world[(x, y, z)])
                    world[(x, y, z)] = "air"
    changed = sum(1 for p in before if before[p] != "air")
    ok &= check("block count is right", frame.blocks == changed,
                f"{frame.blocks} of {changed}")
    for pos, state in replay(frame):
        world[pos] = state
    ok &= check("a cleared world comes back exactly", world == before)

    # A position changed twice in one tick must end on its earliest state.
    twice = Frame()
    twice.record(0, 0, 0, "grass")
    twice.record(0, 0, 0, "dirt")
    spot = {(0, 0, 0): "air"}
    for pos, state in replay(twice):
        spot[pos] = state
    ok &= check("a twice-changed block ends on its earliest state",
                spot[(0, 0, 0)] == "grass", f"got {spot[(0, 0, 0)]}")

    # Scattered changes cannot compress, and must still round-trip.
    loose = Frame()
    original, live, seen = {}, {}, set()
    for _ in range(600):
        p = (random.randint(-40, 40), random.randint(-9, 9), random.randint(-40, 40))
        if p in seen:
            continue
        seen.add(p)
        original[p] = random.choice(["stone", "sand", "oak_log"])
        loose.record(p[0], p[1], p[2], original[p])
        live[p] = "air"
    for pos, state in replay(loose):
        live[pos] = state
    ok &= check("scattered changes round-trip", live == original,
                f"{len(seen)} blocks in {len(loose.runs)} runs")

    # Runs along each axis, since the weapons do not all iterate the same way.
    for axis, step in (("x", (1, 0, 0)), ("y", (0, 1, 0)), ("z", (0, 0, 1))):
        run = Frame()
        want = {}
        for i in range(50):
            p = (step[0] * i, step[1] * i, step[2] * i)
            want[p] = "stone"
            run.record(p[0], p[1], p[2], "stone")
        got = {p: "air" for p in want}
        for pos, state in replay(run):
            got[pos] = state
        ok &= check(f"a run along {axis} compresses and restores",
                    got == want and len(run.runs) == 1,
                    f"{len(run.runs)} run")

    if not ok:
        sys.exit(1)
    print("  journal round-trips correctly")


if __name__ == "__main__":
    main()
