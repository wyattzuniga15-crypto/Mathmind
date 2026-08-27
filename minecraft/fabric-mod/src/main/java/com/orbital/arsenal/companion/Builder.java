package com.orbital.arsenal.companion;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import java.util.ArrayDeque;
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

    /**
     * One queued fill.
     *
     * Jobs run strictly one after another rather than side by side, because
     * order is meaning: a blueprint clears the ground, raises walls, then cuts
     * the doorway out of them. Run those at the same time and the door is cut
     * before there is a wall to cut it from. A single queue also caps the cost
     * of a whole castle at the cost of one fill, however many pieces it is.
     */
    private static final class Job {
        ServerWorld world;
        BlockState state;
        Shape shape;
        int lowX, lowY, lowZ, highX, highY, highZ;
        int x, y, z;
        int placed;
        Runnable then;
    }

    private static final ArrayDeque<Job> QUEUE = new ArrayDeque<>();
    private static boolean draining = false;

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

    /** Queue a fill that announces itself to the player when it lands. */
    public static long fill(ServerWorld world, ServerPlayerEntity tell, String what,
                            BlockState state,
                            int x0, int y0, int z0, int x1, int y1, int z1,
                            Shape shape) {
        Runnable report = tell == null || what == null ? null : () -> {};
        return fill(world, state, x0, y0, z0, x1, y1, z1, shape,
                report == null ? null : new Announce(tell, what));
    }

    /** Announces a finished job, carrying the count it was given at the end. */
    private static final class Announce implements Runnable {
        private final ServerPlayerEntity tell;
        private final String what;
        int placed;

        Announce(ServerPlayerEntity tell, String what) {
            this.tell = tell;
            this.what = what;
        }

        @Override
        public void run() {
            tell.sendMessage(Text.literal("§a✔ " + what + " — " + placed + " blocks"), false);
        }
    }

    /**
     * Queue a fill, running {@code then} once it finishes.
     *
     * Progressive on purpose, and not only to spare the server: a keep that
     * rises course by course is worth watching, and one that appears whole is
     * just a screenshot. The walk runs Y outermost so it climbs.
     *
     * @return the planned bounding volume, or -1 if it was refused as too big
     */
    public static long fill(ServerWorld world, BlockState state,
                            int x0, int y0, int z0, int x1, int y1, int z1,
                            Shape shape, Runnable then) {
        // getBottomY() plus getHeight(), rather than the top-Y accessor: that
        // one has been renamed across versions and this pair has not. The
        // limits differ per dimension, so they have to be asked for, not
        // hardcoded — the Nether's ceiling is nowhere near the Overworld's.
        int floor = world.getBottomY() + 1;
        int ceiling = world.getBottomY() + world.getHeight() - 1;
        Job job = new Job();
        job.world = world;
        job.state = state;
        job.shape = shape;
        job.lowX = Math.min(x0, x1);
        job.highX = Math.max(x0, x1);
        job.lowY = Math.max(floor, Math.min(y0, y1));
        job.highY = Math.min(ceiling, Math.max(y0, y1));
        job.lowZ = Math.min(z0, z1);
        job.highZ = Math.max(z0, z1);
        job.then = then;
        if (job.highY < job.lowY) {
            return -1;
        }

        long volume = (long) (job.highX - job.lowX + 1)
                * (job.highY - job.lowY + 1)
                * (job.highZ - job.lowZ + 1);
        if (volume > MAX_VOLUME) {
            return -1;
        }

        job.x = job.lowX;
        job.y = job.lowY;
        job.z = job.lowZ;
        QUEUE.add(job);
        drain();
        return volume;
    }

    /** One tick task drives the whole queue, however long it gets. */
    private static void drain() {
        if (draining) {
            return;
        }
        draining = true;
        BlockPos.Mutable pos = new BlockPos.Mutable();
        Scheduler.repeat(() -> {
            int cells = CELLS_PER_TICK;
            int writes = PLACE_PER_TICK;
            while (cells > 0 && writes > 0) {
                Job job = QUEUE.peek();
                if (job == null) {
                    draining = false;
                    return false;
                }
                if (job.y > job.highY) {
                    QUEUE.poll();
                    if (job.then instanceof Announce announce) {
                        announce.placed = job.placed;
                    }
                    if (job.then != null) {
                        job.then.run();
                    }
                    continue;
                }
                cells--;
                if (job.shape.contains(job.x, job.y, job.z)) {
                    pos.set(job.x, job.y, job.z);
                    BlockState was = job.world.getBlockState(pos);
                    // Bedrock stays. Skipping a block already correct saves the
                    // write and, more usefully, keeps it out of the journal.
                    if (!was.isOf(Blocks.BEDROCK) && was != job.state) {
                        // Through the journal, so the rewind clocks can undo
                        // anything built exactly as they undo anything blown up.
                        Journal.clear(job.world, pos.toImmutable(), was, job.state);
                        job.placed++;
                        writes--;
                    }
                }
                if (++job.z > job.highZ) {
                    job.z = job.lowZ;
                    if (++job.x > job.highX) {
                        job.x = job.lowX;
                        job.y++;
                    }
                }
            }
            return true;
        });
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
