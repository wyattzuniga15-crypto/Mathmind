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
 * One record serves every clock. Each asks for a different reach — a minute,
 * five, ten, or everything still held — and takes only the frames inside it,
 * leaving older ones for the deeper clocks. That is why there is one journal
 * rather than four: four would each have to see every block change in the
 * world, and the same change would be filed four times over.
 *
 * Two limits, both reachable:
 *
 * Nothing older than an hour is kept, whichever clock is asking. Even the
 * deepest cannot reach past that.
 *
 * The real constraint is the four million change cap, about ninety megabytes.
 * The black hole alone makes twenty-two million, so its oldest changes are
 * evicted while it is still digging and an undo afterwards restores only the
 * last part of it. The cap exists because the alternative is running the game
 * out of memory, which is a worse answer than an incomplete undo.
 */
public final class Journal {
    /** The reaches the clocks ask for, in ticks. */
    public static final int ONE_MINUTE = 1_200;
    public static final int FIVE_MINUTES = 6_000;
    public static final int TEN_MINUTES = 12_000;
    /** Everything still held — which the hour cap below bounds in practice. */
    public static final int EVERYTHING = Integer.MAX_VALUE;

    /** Nothing older than this is kept, whichever clock asks. */
    private static final int MAX_WINDOW = 72_000;      // one hour
    private static final int MAX_ENTRIES = 4_000_000;  // roughly 90 MB
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
            if (now - oldest.tick <= MAX_WINDOW && log.entries <= MAX_ENTRIES) {
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
     * Put the world back as it stood `windowTicks` ago, and report how many
     * changes that took. Returns 0 if nothing inside that reach was recorded.
     *
     * Only frames inside the window are taken. Everything older stays, so
     * undoing the last minute leaves the previous nine intact and a deeper
     * clock can still reach them afterwards.
     *
     * Replay runs newest first, the only order that walks a position changed
     * several times inside the window back to the state it held at the start
     * rather than to some middle one.
     */
    public static int rewind(ServerWorld world, int windowTicks) {
        Log log = LOGS.get(world);
        if (log == null || log.entries == 0) {
            return 0;
        }

        // Take the frames in scope off the live log before replaying them, or
        // the restore's own writes would land in frames still being read.
        ArrayDeque<Frame> replay = new ArrayDeque<>();
        int total = 0;
        while (!log.frames.isEmpty()) {
            Frame newest = log.frames.peekLast();
            if ((long) now - newest.tick > windowTicks) {
                break;
            }
            log.frames.pollLast();
            log.entries -= newest.size;
            total += newest.size;
            // Newest first, so taking from the front replays in the right order.
            replay.addLast(newest);
        }
        log.current = null;
        if (total == 0) {
            return 0;
        }

        Scheduler.repeat(() -> {
            int budget = RESTORE_PER_TICK;
            while (budget > 0) {
                Frame frame = replay.peekFirst();
                if (frame == null) {
                    return false;
                }
                while (frame.size > 0 && budget > 0) {
                    frame.size--;
                    BlockPos at = BlockPos.fromLong(frame.pos[frame.size]);
                    suppressed = true;
                    // Flag 2 again: neighbour updates across a restore this
                    // size cost more than the restore, and re-settling sand
                    // and water that were mid-fall is not wanted anyway.
                    world.setBlockState(at, frame.was[frame.size], 2);
                    suppressed = false;
                    budget--;
                }
                if (frame.size == 0) {
                    replay.pollFirst();
                }
            }
            return true;
        });
        return total;
    }
}
