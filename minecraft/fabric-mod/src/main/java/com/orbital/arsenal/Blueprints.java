package com.orbital.arsenal;

import com.orbital.arsenal.companion.Builder;
import java.util.List;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.math.Vec3d;

/**
 * Buildings you can have without an account.
 *
 * The companion builds anything you can describe, but it needs an API key, and
 * "sign up for something before the mod does anything" is a bad first ten
 * minutes. These are the same shapes the companion composes, arranged ahead of
 * time — so /build castle works the moment the jar is installed.
 *
 * Every one of them clears its footprint first, then raises the structure, then
 * cuts the openings. That order is why the builder runs one job at a time: cut
 * a doorway concurrently with the wall it goes in and you get a wall with no
 * door, or a door filled in behind you.
 */
public final class Blueprints {
    private Blueprints() {}

    public static final List<String> NAMES = List.of(
            "house", "tower", "castle", "pyramid", "dome", "bridge", "wall");

    private static final BlockState STONE = Blocks.STONE_BRICKS.getDefaultState();
    private static final BlockState DARK = Blocks.DEEPSLATE_BRICKS.getDefaultState();
    private static final BlockState WOOD = Blocks.OAK_PLANKS.getDefaultState();
    private static final BlockState LOG = Blocks.OAK_LOG.getDefaultState();
    private static final BlockState GLASS = Blocks.GLASS.getDefaultState();
    private static final BlockState SAND = Blocks.SANDSTONE.getDefaultState();
    private static final BlockState LIGHT = Blocks.GLOWSTONE.getDefaultState();
    private static final BlockState AIR = Blocks.AIR.getDefaultState();

    /**
     * Put up {@code name} where the player stands.
     *
     * @return false if there is no blueprint by that name
     */
    public static boolean raise(ServerWorld world, ServerPlayerEntity player, String name) {
        int x = (int) Math.floor(player.getX());
        int y = (int) Math.floor(player.getY());
        int z = (int) Math.floor(player.getZ());
        String want = name == null ? "" : name.trim().toLowerCase();

        switch (want) {
            case "house" -> house(world, player, x, y, z);
            case "tower" -> tower(world, player, x, y, z);
            case "castle" -> castle(world, player, x, y, z);
            case "pyramid" -> pyramid(world, player, x, y, z);
            case "dome" -> dome(world, player, x, y, z);
            case "bridge" -> bridge(world, player, x, y, z);
            case "wall" -> wall(world, player, x, y, z);
            default -> {
                return false;
            }
        }
        return true;
    }

    // ---- the buildings ----------------------------------------------------

    /** A cottage: floor, walls, a pitched roof, a door and four windows. */
    private static void house(ServerWorld world, ServerPlayerEntity player, int x, int y, int z) {
        int w = 5;   // half width
        int d = 4;   // half depth
        int h = 5;   // wall height

        clear(world, x - w - 1, y, z - d - 1, x + w + 1, y + h + w, z + d + 1);
        shell(world, LOG, x - w, y, z - d, x + w, y + h, z + d);
        // The shell's own bottom face is the floor — relaid in planks rather
        // than adding another one under it, which would sit a block proud of
        // the doorway and block it.
        fill(world, WOOD, x - w, y, z - d, x + w, y, z + d);

        // A pitched roof as a stack of shrinking slabs. Each course is one
        // block narrower and one higher, which is a gable without needing
        // stairs or any block that cares which way it faces.
        for (int i = 0; i <= w; i++) {
            fill(world, STONE, x - w + i, y + h + i, z - d - 1, x + w - i, y + h + i, z + d + 1);
        }

        // Openings last, cut back out of the finished walls.
        fill(world, AIR, x, y + 1, z - d, x, y + 2, z - d);                // door
        fill(world, GLASS, x - 3, y + 2, z - d, x - 2, y + 3, z - d);
        fill(world, GLASS, x + 2, y + 2, z - d, x + 3, y + 3, z - d);
        fill(world, GLASS, x - 3, y + 2, z + d, x - 2, y + 3, z + d);
        fill(world, GLASS, x + 2, y + 2, z + d, x + 3, y + 3, z + d);
        set(world, LIGHT, x, y + h - 1, z);
        done(world, player, "house", x, y, z);
    }

    /** A round keep with floors, arrow slits and battlements. */
    private static void tower(ServerWorld world, ServerPlayerEntity player, int x, int y, int z) {
        int r = 5;
        int h = 30;

        clear(world, x - r - 1, y, z - r - 1, x + r + 1, y + h + 2, z + r + 1);
        Builder.fill(world, STONE, x - r, y, z - r, x + r, y + h, z + r,
                Builder.cylinder(x, z, r + 0.5, true), null);

        // A floor every six blocks, and a light on each so it is not a well.
        for (int floor = 6; floor < h; floor += 6) {
            Builder.fill(world, WOOD, x - r, y + floor, z - r, x + r, y + floor, z + r,
                    Builder.cylinder(x, z, r - 0.5, false), null);
            set(world, LIGHT, x, y + floor + 3, z);
        }

        fill(world, AIR, x, y + 1, z - r, x, y + 2, z - r);                 // door
        for (int slit = 4; slit < h; slit += 6) {                           // arrow slits
            fill(world, AIR, x - r, y + slit, z, x + r, y + slit + 1, z);
            fill(world, AIR, x, y + slit, z - r, x, y + slit + 1, z + r);
        }
        crenellate(world, x, y + h + 1, z, r, true);
        done(world, player, "tower", x, y, z);
    }

    /** Curtain walls, four corner towers, a courtyard and a gate. */
    private static void castle(ServerWorld world, ServerPlayerEntity player, int x, int y, int z) {
        int s = 20;   // half the side
        int h = 9;    // wall height

        clear(world, x - s - 5, y, z - s - 5, x + s + 5, y + 20, z + s + 5);
        shell(world, STONE, x - s, y, z - s, x + s, y + h, z + s);
        // Roof and floor of the shell are not wanted: open the courtyard back
        // up, and leave the ground as ground.
        fill(world, AIR, x - s + 1, y, z - s + 1, x + s - 1, y + h, z + s - 1);
        fill(world, STONE, x - s + 1, y - 1, z - s + 1, x + s - 1, y - 1, z + s - 1);

        // Corner towers, taller than the walls so they read as towers.
        for (int cx = -1; cx <= 1; cx += 2) {
            for (int cz = -1; cz <= 1; cz += 2) {
                int tx = x + cx * s;
                int tz = z + cz * s;
                Builder.fill(world, DARK, tx - 4, y, tz - 4, tx + 4, y + h + 6, tz + 4,
                        Builder.cylinder(tx, tz, 4.5, true), null);
                Builder.fill(world, DARK, tx - 4, y + h + 6, tz - 4, tx + 4, y + h + 6, tz + 4,
                        Builder.cylinder(tx, tz, 3.5, false), null);
                crenellate(world, tx, y + h + 7, tz, 4, true);
                set(world, LIGHT, tx, y + h + 4, tz);
            }
        }

        // Gatehouse: a hole through the south wall, framed and lit.
        fill(world, AIR, x - 2, y, z - s, x + 2, y + 4, z - s);
        fill(world, DARK, x - 3, y, z - s - 1, x - 3, y + h, z - s - 1);
        fill(world, DARK, x + 3, y, z - s - 1, x + 3, y + h, z - s - 1);
        set(world, LIGHT, x - 3, y + 5, z - s - 1);
        set(world, LIGHT, x + 3, y + 5, z - s - 1);
        crenellate(world, x, y + h, z, s, false);
        done(world, player, "castle", x, y, z);
    }

    /** A stepped pyramid with a chamber inside it. */
    private static void pyramid(ServerWorld world, ServerPlayerEntity player, int x, int y, int z) {
        int base = 24;
        clear(world, x - base - 1, y, z - base - 1, x + base + 1, y + base + 1, z + base + 1);
        for (int i = 0; i <= base; i++) {
            int r = base - i;
            fill(world, SAND, x - r, y + i, z - r, x + r, y + i, z + r);
        }
        // The chamber is carved after the solid, which is far cheaper than
        // trying to leave a hole while stacking the courses.
        fill(world, AIR, x - 4, y, z - 4, x + 4, y + 5, z + 4);
        fill(world, AIR, x, y, z - base, x, y + 3, z - 4);
        set(world, LIGHT, x, y + 4, z);
        set(world, Blocks.GOLD_BLOCK.getDefaultState(), x, y, z);
        done(world, player, "pyramid", x, y, z);
    }

    /** A glass dome, for putting over a crater. */
    private static void dome(ServerWorld world, ServerPlayerEntity player, int x, int y, int z) {
        int r = 24;
        Builder.fill(world, GLASS, x - r, y, z - r, x + r, y + r, z + r,
                Builder.sphere(x, y, z, r + 0.5, true, true), null);
        fill(world, AIR, x - 1, y, z - r, x + 1, y + 3, z - r + 2);
        set(world, LIGHT, x, y + r - 2, z);
        done(world, player, "dome", x, y, z);
    }

    /** A span running the way you are facing, with railings and supports. */
    private static void bridge(ServerWorld world, ServerPlayerEntity player, int x, int y, int z) {
        // Along whichever axis you are more nearly facing, so it goes where you
        // are looking rather than always running north.
        Vec3d look = player.getRotationVec(1.0F);
        boolean alongX = Math.abs(look.x) >= Math.abs(look.z);
        int sign = (alongX ? look.x : look.z) < 0 ? -1 : 1;
        int length = 60;
        int half = 3;

        int x2 = alongX ? x + sign * length : x;
        int z2 = alongX ? z : z + sign * length;
        int ax = Math.min(x, x2), bx = Math.max(x, x2);
        int az = Math.min(z, z2), bz = Math.max(z, z2);
        int px = alongX ? 0 : half;   // half-width across the span
        int pz = alongX ? half : 0;

        clear(world, ax - half - 1, y, az - half - 1, bx + half + 1, y + 4, bz + half + 1);
        fill(world, STONE, ax - px, y - 1, az - pz, bx + px, y - 1, bz + pz);
        // Railings: two lines down the outer edges.
        fill(world, LOG, ax - px, y, az - pz, bx + px, y, bz + pz);
        fill(world, LOG, ax + px, y, az + pz, bx + px, y, bz + pz);
        fill(world, AIR, ax - px + (alongX ? 0 : 1), y, az - pz + (alongX ? 1 : 0),
                bx + px - (alongX ? 0 : 1), y, bz + pz - (alongX ? 1 : 0));
        // Piers every twelve blocks, dropped far enough to meet most ground.
        for (int i = 12; i < length; i += 12) {
            int sx = alongX ? x + sign * i : x;
            int sz = alongX ? z : z + sign * i;
            fill(world, STONE, sx - 1, y - 30, sz - 1, sx + 1, y - 2, sz + 1);
        }
        done(world, player, "bridge", x, y, z);
    }

    /** A long battlemented wall across your line of sight. */
    private static void wall(ServerWorld world, ServerPlayerEntity player, int x, int y, int z) {
        Vec3d look = player.getRotationVec(1.0F);
        // Across the way you face, not along it — a wall you walk into.
        boolean alongX = Math.abs(look.z) >= Math.abs(look.x);
        int length = 60;
        int h = 8;
        int ax = alongX ? x - length / 2 : x - 1;
        int bx = alongX ? x + length / 2 : x + 1;
        int az = alongX ? z - 1 : z - length / 2;
        int bz = alongX ? z + 1 : z + length / 2;

        clear(world, ax, y, az, bx, y + h + 2, bz);
        fill(world, STONE, ax, y, az, bx, y + h, bz);
        // Merlons: every other block along the top, in one pass.
        for (int i = 0; i <= length; i += 2) {
            int mx = alongX ? ax + i : x;
            int mz = alongX ? z : az + i;
            fill(world, DARK, mx - (alongX ? 0 : 1), y + h + 1, mz - (alongX ? 1 : 0),
                    mx + (alongX ? 0 : 1), y + h + 1, mz + (alongX ? 1 : 0));
        }
        done(world, player, "wall", x, y, z);
    }

    // ---- pieces used by more than one building ---------------------------

    /** Teeth around the top of a round or square structure. */
    private static void crenellate(ServerWorld world, int cx, int y, int cz, int r, boolean round) {
        double outer = (r + 0.5) * (r + 0.5);
        double inner = (r - 0.5) * (r - 0.5);
        Builder.fill(world, DARK, cx - r, y, cz - r, cx + r, y + 1, cz + r, (bx, by, bz) -> {
            // Alternate on the sum of the coordinates: the gaps then fall in a
            // regular pattern all the way round a circle, which stepping along
            // an edge cannot do at a corner.
            if (((bx + bz) & 1) == 1) {
                return false;
            }
            double dx = bx - cx, dz = bz - cz;
            double d = dx * dx + dz * dz;
            if (round) {
                return d <= outer && d > inner;
            }
            return Math.abs(dx) == r || Math.abs(dz) == r;
        }, null);
    }

    private static void clear(ServerWorld world, int x0, int y0, int z0, int x1, int y1, int z1) {
        fill(world, AIR, x0, y0, z0, x1, y1, z1);
    }

    private static void fill(ServerWorld world, BlockState state,
                             int x0, int y0, int z0, int x1, int y1, int z1) {
        Builder.fill(world, state, x0, y0, z0, x1, y1, z1,
                Builder.box(x0, y0, z0, x1, y1, z1, false), null);
    }

    private static void shell(ServerWorld world, BlockState state,
                              int x0, int y0, int z0, int x1, int y1, int z1) {
        Builder.fill(world, state, x0, y0, z0, x1, y1, z1,
                Builder.box(x0, y0, z0, x1, y1, z1, true), null);
    }

    private static void set(ServerWorld world, BlockState state, int x, int y, int z) {
        fill(world, state, x, y, z, x, y, z);
    }

    /** The one message a whole blueprint sends, queued behind all its pieces. */
    private static void done(ServerWorld world, ServerPlayerEntity player,
                             String what, int x, int y, int z) {
        // A marker that matches nothing, queued behind every piece, purely so
        // there is one message at the end instead of a dozen. At the player's
        // own Y, because anywhere else risks being outside the build limits —
        // and a refused fill is a message that never arrives.
        Builder.fill(world, AIR, x, y, z, x, y, z,
                (bx, by, bz) -> false,
                () -> player.sendMessage(Text.literal(
                        "§a✔ Your " + what + " is finished."), false));
    }
}
