package com.orbital.arsenal.companion;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.registry.Registries;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;

/**
 * The companion's hands.
 *
 * A model cannot build by naming every block. A castle is fifty thousand of
 * them — more than fits in one reply, let alone twenty. So nothing here takes
 * a list of positions. Each shape is a *rule* about which positions are inside
 * it, and the rule is what gets walked. A tower is one call rather than four
 * thousand, and the model gets to reason about proportion instead of
 * bookkeeping.
 *
 * Every shape reduces to the same two things: a bounding box, and a test for
 * whether a point in it belongs. Solid, hollow, dome, pillar — all of them are
 * that pair, which is why there is only one placement loop below.
 */
public final class Builder {
    private Builder() {}

    /**
     * Two budgets, because the two costs are nothing alike. Testing whether a
     * cell is inside a shape is arithmetic; writing a block touches the world
     * and tells every nearby client. A hollow sphere is mostly the former, a
     * solid box mostly the latter, and one budget for both would either stall
     * the server on solids or crawl on hollows.
     */
    private static final int CELLS_PER_TICK = 60_000;
    private static final int PLACE_PER_TICK = 4_000;

    /** A hard ceiling on one job, so a slipped digit cannot eat the world. */
    public static final long MAX_VOLUME = 4_000_000L;

    /** Which points belong to a shape. Coordinates are absolute. */
    public interface Shape {
        boolean contains(int x, int y, int z);
    }

    /** Look up a block by its plain id, or null if there is no such block. */
    public static BlockState block(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        String id = name.trim().toLowerCase().replace("minecraft:", "");
        Identifier identifier = Identifier.tryParse("minecraft:" + id);
        if (identifier == null) {
            return null;
        }
        Block found = Registries.BLOCK.get(identifier);
        // A miss returns AIR rather than null, so asking for air explicitly is
        // the only way that answer is real.
        if (found == Blocks.AIR && !id.equals("air")) {
            return null;
        }
        return found.getDefaultState();
    }

    /**
     * Fill every point of {@code shape} inside the given bounds with
     * {@code state}, a few thousand blocks a tick.
     *
     * Progressive on purpose, and not only to spare the server: a keep that
     * rises course by course is worth watching, and one that appears whole is
     * just a screenshot. The walk runs Y outermost so it climbs.
     *
     * @return the planned bounding volume, or -1 if it was refused as too big
     */
    public static long fill(ServerWorld world, ServerPlayerEntity tell, String what,
                            BlockState state,
                            int x0, int y0, int z0, int x1, int y1, int z1,
                            Shape shape) {
        int lowX = Math.min(x0, x1), highX = Math.max(x0, x1);
        // getBottomY() plus getHeight(), rather than the top-Y accessor: that
        // one has been renamed across versions and this pair has not. The
        // limits differ per dimension, so they have to be asked for, not
        // hardcoded — the Nether's ceiling is nowhere near the Overworld's.
        int floor = world.getBottomY() + 1;
        int ceiling = world.getBottomY() + world.getHeight() - 1;
        int lowY = Math.max(floor, Math.min(y0, y1));
        int highY = Math.min(ceiling, Math.max(y0, y1));
        int lowZ = Math.min(z0, z1), highZ = Math.max(z0, z1);
        if (highY < lowY) {
            return -1;
        }

        long volume = (long) (highX - lowX + 1) * (highY - lowY + 1) * (highZ - lowZ + 1);
        if (volume > MAX_VOLUME) {
            return -1;
        }

        int[] cx = {lowX};
        int[] cy = {lowY};
        int[] cz = {lowZ};
        int[] placed = {0};
        BlockPos.Mutable pos = new BlockPos.Mutable();

        Scheduler.repeat(() -> {
            int cells = CELLS_PER_TICK;
            int writes = PLACE_PER_TICK;
            while (cells-- > 0 && writes > 0) {
                if (cy[0] > highY) {
                    done(tell, what, placed[0]);
                    return false;
                }
                if (shape.contains(cx[0], cy[0], cz[0])) {
                    pos.set(cx[0], cy[0], cz[0]);
                    BlockState was = world.getBlockState(pos);
                    // Bedrock stays. Skipping a block already correct saves the
                    // write and, more usefully, keeps it out of the journal.
                    if (!was.isOf(Blocks.BEDROCK) && was != state) {
                        // Through the journal, so the rewind clocks can undo
                        // anything built exactly as they undo anything blown up.
                        Journal.clear(world, pos.toImmutable(), was, state);
                        placed[0]++;
                        writes--;
                    }
                }
                if (++cz[0] > highZ) {
                    cz[0] = lowZ;
                    if (++cx[0] > highX) {
                        cx[0] = lowX;
                        cy[0]++;
                    }
                }
            }
            return true;
        });
        return volume;
    }

    private static void done(ServerPlayerEntity tell, String what, int placed) {
        if (tell != null) {
            tell.sendMessage(Text.literal("§a✔ " + what + " — " + placed + " blocks"), false);
        }
    }

    // ---- the shapes themselves -------------------------------------------

    /** Solid, or just the six faces of the box. */
    public static Shape box(int x0, int y0, int z0, int x1, int y1, int z1, boolean hollow) {
        if (!hollow) {
            return (x, y, z) -> true;
        }
        int lowX = Math.min(x0, x1), highX = Math.max(x0, x1);
        int lowY = Math.min(y0, y1), highY = Math.max(y0, y1);
        int lowZ = Math.min(z0, z1), highZ = Math.max(z0, z1);
        return (x, y, z) -> x == lowX || x == highX
                || y == lowY || y == highY
                || z == lowZ || z == highZ;
    }

    /**
     * A ball, or a shell one block thick.
     *
     * Hollow is "inside the sphere but not inside a sphere one block smaller",
     * which gives an even shell at every angle. Testing distance against a band
     * instead leaves the shell thin at the poles and thick at the equator.
     */
    public static Shape sphere(int cx, int cy, int cz, double r, boolean hollow, boolean dome) {
        double outer = r * r;
        double inner = (r - 1.0) * (r - 1.0);
        return (x, y, z) -> {
            if (dome && y < cy) {
                return false;
            }
            double dx = x - cx, dy = y - cy, dz = z - cz;
            double d = dx * dx + dy * dy + dz * dz;
            return d <= outer && (!hollow || d > inner);
        };
    }

    /** A pillar or a tube: round in plan, straight up. */
    public static Shape cylinder(int cx, int cz, double r, boolean hollow) {
        double outer = r * r;
        double inner = (r - 1.0) * (r - 1.0);
        return (x, y, z) -> {
            double dx = x - cx, dz = z - cz;
            double d = dx * dx + dz * dz;
            return d <= outer && (!hollow || d > inner);
        };
    }

    /**
     * A beam between two points, of a given thickness.
     *
     * Point-to-segment distance rather than a stepped walk: a walk has to pick
     * a driving axis and leaves gaps on the diagonals, while a distance test is
     * the same beam whichever way it points.
     */
    public static Shape line(int x0, int y0, int z0, int x1, int y1, int z1, double thickness) {
        double ax = x0, ay = y0, az = z0;
        double bx = x1 - x0, by = y1 - y0, bz = z1 - z0;
        double len = bx * bx + by * by + bz * bz;
        double limit = thickness * thickness;
        return (x, y, z) -> {
            double px = x - ax, py = y - ay, pz = z - az;
            // How far along the segment the nearest point lies, clamped to its
            // ends so the beam stops rather than running on forever.
            double t = len == 0 ? 0 : (px * bx + py * by + pz * bz) / len;
            t = t < 0 ? 0 : (t > 1 ? 1 : t);
            double dx = px - bx * t, dy = py - by * t, dz = pz - bz * t;
            return dx * dx + dy * dy + dz * dz <= limit;
        };
    }
}
