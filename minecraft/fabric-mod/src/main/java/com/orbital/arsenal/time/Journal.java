package com.orbital.arsenal.time;

import com.orbital.arsenal.Scheduler;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.IdentityHashMap;
import java.util.Map;
import net.minecraft.block.BlockState;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;

/**
 * A rolling record of what the world used to look like.
 *
 * Every block change is filed with the state that was there before it, grouped
 * by the tick it happened on. Replaying those backwards puts the world back.
 *
 * Recording runs all the time, for every change in the world whoever made it —
 * a creeper, a fire, a pickaxe, another mod. It is affordable because a normal
 * world simply does not change much: a few hundred blocks a second at the
 * outside, against a cap sized for the twenty-two million a black hole makes.
 * The cost of an idle world is a map lookup and an array append per change.
 *
 * Note what that means, since it is the whole point and also the sharp edge:
 * the clock undoes the last thirty seconds of *everything*. Blocks you placed
 * in that window are un-placed too. It is an undo, not a repair tool.
 *
 * Two limits are worth stating plainly, because both are reachable in normal
 * use of this mod:
 *
 * The window is thirty seconds. Anything older is dropped as it ages out —
 * that is what keeps this from growing without bound in a world that is being
 * built in as well as blown up.
 *
 * The record also caps at two million changes, which is the real constraint.
 * Two million entries costs roughly forty megabytes; the black hole alone
 * makes twenty-two million, so the oldest of its changes are evicted while it
 * is still digging and a rewind after one restores only the last part. The cap
 * exists because the alternative is running the game out of memory, which is a
 * worse answer than an incomplete undo.
 */
public final class Journal {
    private static final int WINDOW = 600;             // 30 seconds
    private static final int MAX_ENTRIES = 2_000_000;
    private static final int RESTORE_PER_TICK = 40_000;

    /**
     * Set while this class is writing a block itself, so the mixin that watches
     * every change in the world does not file the undo as a new change to undo.
     */
    public static boolean suppressed = false;

    /** One tick's worth of changes, in the order they happened. */
    private static final class Frame {
        final int tick;
        long[] pos = new long[128];
        BlockState[] was = new BlockState[128];
        int size;

        Frame(int tick) {
            this.tick = tick;
        }

        void add(long p, BlockState state) {
            if (size == pos.length) {
                pos = Arrays.copyOf(pos, size * 2);
                was = Arrays.copyOf(was, size * 2);
            }
            pos[size] = p;
            was[size] = state;
            size++;
        }
    }

    private static final class Log {
        final ArrayDeque<Frame> frames = new ArrayDeque<>();
        Frame current;
        int entries;
    }

    // Per world: the Nether and the Overworld cannot share a record, since a
    // position means a different place in each.
    private static final Map<ServerWorld, Log> LOGS = new IdentityHashMap<>();
    private static int now = 0;

    private Journal() {}

    /** File one change. `was` is the state standing there before it. */
    public static void record(ServerWorld world, BlockPos pos, BlockState was) {
        Log log = LOGS.get(world);
        if (log == null) {
            log = new Log();
            LOGS.put(world, log);
        }
        if (log.current == null || log.current.tick != now) {
            log.current = new Frame(now);
            log.frames.addLast(log.current);
        }
        log.current.add(pos.asLong(), was);
        log.entries++;
        trim(log);
    }

    /** Clear a block and file it, in one step, so nothing can do one without the other. */
    public static void clear(ServerWorld world, BlockPos pos, BlockState was, BlockState to) {
        record(world, pos, was);
        suppressed = true;
        world.setBlockState(pos, to, 2);
        suppressed = false;
    }

    private static void trim(Log log) {
        while (!log.frames.isEmpty()) {
            Frame oldest = log.frames.peekFirst();
            if (now - oldest.tick <= WINDOW && log.entries <= MAX_ENTRIES) {
                return;
            }
            log.frames.pollFirst();
            log.entries -= oldest.size;
            if (log.current == oldest) {
                log.current = null;
            }
        }
        log.entries = 0;
    }

    public static void tick() {
        now++;
        for (Log log : LOGS.values()) {
            trim(log);
        }
    }

    /**
     * Put the world back as it stood thirty seconds ago, and report how many
     * changes that is. Returns 0 if nothing has happened worth undoing.
     *
     * Replay runs newest first: a position changed several times inside the
     * window is walked back through each of them and ends on the state it held
     * at the start, which is the only order that gets that right.
     */
    public static int rewind(ServerWorld world) {
        Log log = LOGS.get(world);
        if (log == null || log.entries == 0) {
            return 0;
        }
        int total = log.entries;

        // Take the record away from the live log before replaying it. Otherwise
        // the restore's own writes would land in the frames still being read.
        ArrayDeque<Frame> frames = new ArrayDeque<>(log.frames);
        log.frames.clear();
        log.current = null;
        log.entries = 0;

        Scheduler.repeat(() -> {
            int budget = RESTORE_PER_TICK;
            while (budget > 0) {
                Frame frame = frames.peekLast();
                if (frame == null) {
                    return false;
                }
                while (frame.size > 0 && budget > 0) {
                    frame.size--;
                    BlockPos at = BlockPos.fromLong(frame.pos[frame.size]);
                    suppressed = true;
                    // Flag 2 again: neighbour updates across a restore this size
                    // cost more than the restore, and re-settling sand and water
                    // that were mid-fall is not wanted anyway.
                    world.setBlockState(at, frame.was[frame.size], 2);
                    suppressed = false;
                    budget--;
                }
                if (frame.size == 0) {
                    frames.pollLast();
                }
            }
            return true;
        });
        return total;
    }
}
