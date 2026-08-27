package com.orbital.arsenal.time;

import com.orbital.arsenal.OrbitalArsenal;
import com.orbital.arsenal.Scheduler;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.IdentityHashMap;
import java.util.Map;
import net.minecraft.block.BlockState;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;

/**
 * A rolling record of what the world used to look like.
 *
 * Every block change is filed with the state that was there before it, grouped
 * by the tick it happened on. Replaying those backwards puts the world back.
 *
 * **Changes are stored as runs, not as blocks.** That is the difference
 * between undoing a black hole and undoing a fifth of one. These weapons clear
 * in contiguous rows — the nuke and the black hole both walk a whole line of
 * z at a time — so a row of two hundred stone becoming air is one entry here
 * rather than two hundred. A run costs about half again what a single block
 * did, and the big weapons produce runs hundreds long, so the record now holds
 * an entire black hole where before it could keep only the tail of one.
 *
 * A run only forms when consecutive changes are adjacent and had the same
 * block before them, which is exactly what bulk clearing looks like and is
 * never what a player mining looks like. Nothing is lost when runs do not
 * form; the record simply falls back to one entry per block.
 *
 * One record serves every clock. Each asks for a different reach — a minute,
 * five, ten, or everything still held — and takes only the runs inside it,
 * leaving older ones for the deeper clocks.
 *
 * Two limits remain: nothing older than an hour is kept, and the record caps
 * at three million runs, which is where memory rather than time runs out.
 */
public final class Journal {
    /** The reaches the clocks ask for, in ticks. */
    public static final int ONE_MINUTE = 1_200;
    public static final int FIVE_MINUTES = 6_000;
    public static final int TEN_MINUTES = 12_000;
    /** Everything still held — which the hour cap below bounds in practice. */
    public static final int EVERYTHING = Integer.MAX_VALUE;

    private static final int MAX_WINDOW = 72_000;    // one hour
    /** Runs, not blocks. At the compression the big weapons get, this is a lot of world. */
    private static final int MAX_RUNS = 3_000_000;
    private static final int RESTORE_PER_TICK = 40_000;
    /** A run's length is a short, so it cannot exceed this. */
    private static final int MAX_RUN = Short.MAX_VALUE;

    private static final byte AXIS_X = 0;
    private static final byte AXIS_Y = 1;
    private static final byte AXIS_Z = 2;

    /**
     * Set while this class is writing a block itself, so the mixin that watches
     * every change in the world does not file the undo as a new change to undo.
     */
    public static boolean suppressed = false;

    /** One tick's worth of changes, as runs, in the order they happened. */
    private static final class Frame {
        final int tick;
        int[] x = new int[64];
        int[] y = new int[64];
        int[] z = new int[64];
        BlockState[] was = new BlockState[64];
        short[] length = new short[64];
        byte[] axis = new byte[64];
        int size;      // runs
        int blocks;    // blocks across those runs

        Frame(int tick) {
            this.tick = tick;
        }

        void start(int px, int py, int pz, BlockState state) {
            if (size == x.length) {
                int bigger = size * 2;
                x = Arrays.copyOf(x, bigger);
                y = Arrays.copyOf(y, bigger);
                z = Arrays.copyOf(z, bigger);
                was = Arrays.copyOf(was, bigger);
                length = Arrays.copyOf(length, bigger);
                axis = Arrays.copyOf(axis, bigger);
            }
            x[size] = px;
            y[size] = py;
            z[size] = pz;
            was[size] = state;
            length[size] = 1;
            axis[size] = AXIS_Z;
            size++;
            blocks++;
        }

        /**
         * Extend the last run if this change carries straight on from it.
         *
         * BlockStates are interned, so identity is the right comparison and a
         * cheap one — this runs on every block change in the game.
         */
        boolean extend(int px, int py, int pz, BlockState state) {
            int last = size - 1;
            if (last < 0 || was[last] != state || length[last] >= MAX_RUN) {
                return false;
            }
            int len = length[last];
            int ex = x[last];
            int ey = y[last];
            int ez = z[last];
            byte along = axis[last];

            if (len == 1) {
                // A run of one has no direction yet, so any neighbour sets it.
                if (px == ex + 1 && py == ey && pz == ez) {
                    axis[last] = AXIS_X;
                } else if (py == ey + 1 && px == ex && pz == ez) {
                    axis[last] = AXIS_Y;
                } else if (pz == ez + 1 && px == ex && py == ey) {
                    axis[last] = AXIS_Z;
                } else {
                    return false;
                }
            } else {
                boolean follows = switch (along) {
                    case AXIS_X -> px == ex + len && py == ey && pz == ez;
                    case AXIS_Y -> py == ey + len && px == ex && pz == ez;
                    default -> pz == ez + len && px == ex && py == ey;
                };
                if (!follows) {
                    return false;
                }
            }
            length[last]++;
            blocks++;
            return true;
        }
    }

    private static final class Log {
        final ArrayDeque<Frame> frames = new ArrayDeque<>();
        Frame current;
        int runs;
    }

    // Per world: the Nether and the Overworld cannot share a record, since a
    // position means a different place in each.
    private static final Map<ServerWorld, Log> LOGS = new IdentityHashMap<>();
    private static int now = 0;

    /**
     * How many block writes in one tick is too many.
     *
     * Area spreads its sweeps over ticks under exactly this budget, but an item
     * that loops over a region itself bypasses that, and the symptom in game is
     * a freeze with nothing in the log to say why. Static analysis could not
     * tell the difference — a check on nested loops flagged nine items of which
     * seven were fine — so count the real writes instead and let an over-budget
     * tick name itself.
     */
    private static final int TICK_BUDGET = 9_000;
    private static int writtenThisTick = 0;
    private static boolean warnedThisTick = false;

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
        if (++writtenThisTick > TICK_BUDGET && !warnedThisTick) {
            warnedThisTick = true;
            OrbitalArsenal.LOGGER.warn(
                    "over {} block changes in one tick — something is sweeping a region "
                    + "without a budget, and the server will stutter", TICK_BUDGET);
        }
        int px = pos.getX();
        int py = pos.getY();
        int pz = pos.getZ();
        if (!log.current.extend(px, py, pz, was)) {
            log.current.start(px, py, pz, was);
            log.runs++;
            trim(log);
        }
    }

    /** Clear a block and file it, in one step, so nothing can do one without the other. */
    public static void clear(ServerWorld world, BlockPos pos, BlockState was, BlockState to) {
        record(world, pos, was);
        suppressed = true;
        try {
            world.setBlockState(pos, to, 2);
        } finally {
            // try/finally, not a plain pair of assignments. If setBlockState
            // throws — and it can, at a chunk boundary or a world edge — the
            // flag would stay raised and the mixin would stop recording
            // anything at all. Every clock in the mod would then quietly do
            // nothing, with no error and no way to tell from inside the game.
            suppressed = false;
        }
    }

    /**
     * Run {@code work} without filing any of it.
     *
     * For changes whose net effect on the world is nothing: a sculpture is
     * assembled a block at a time in mid-air and immediately released, so
     * every one of those blocks is filed twice — once placed, once removed —
     * and a giant cake alone puts five thousand entries into the record for a
     * shape that was never part of the world. That is the record's capacity
     * spent on nothing, crowding out the craters it exists to undo.
     */
    public static void unrecorded(Runnable work) {
        boolean before = suppressed;
        suppressed = true;
        try {
            work.run();
        } finally {
            suppressed = before;
        }
    }

    private static void trim(Log log) {
        while (!log.frames.isEmpty()) {
            Frame oldest = log.frames.peekFirst();
            if (now - oldest.tick <= MAX_WINDOW && log.runs <= MAX_RUNS) {
                return;
            }
            log.frames.pollFirst();
            log.runs -= oldest.size;
            if (log.current == oldest) {
                log.current = null;
            }
        }
        log.runs = 0;
    }

    public static void tick() {
        now++;

        writtenThisTick = 0;
        warnedThisTick = false;
        for (Log log : LOGS.values()) {
            trim(log);
        }
    }

    /**
     * Put the world back as it stood `windowTicks` ago, and report how many
     * blocks that took. Returns 0 if nothing inside that reach was recorded.
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
        if (log == null || log.frames.isEmpty()) {
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
            log.runs -= newest.size;
            total += newest.blocks;
            replay.addLast(newest);   // newest first
        }
        log.current = null;
        if (total == 0) {
            return 0;
        }

        // The extent of what gets put back, gathered as it goes. Anything
        // standing inside it when the restore finishes has been buried.
        int[] bounds = {Integer.MAX_VALUE, Integer.MAX_VALUE, Integer.MAX_VALUE,
                        Integer.MIN_VALUE, Integer.MIN_VALUE, Integer.MIN_VALUE};
        BlockPos.Mutable at = new BlockPos.Mutable();

        Scheduler.repeat(() -> {
            int budget = RESTORE_PER_TICK;
            while (budget > 0) {
                Frame frame = replay.peekFirst();
                if (frame == null) {
                    Unbury.sweep(world, new Box(
                            bounds[0] - 1, bounds[1] - 1, bounds[2] - 1,
                            bounds[3] + 2, bounds[4] + 3, bounds[5] + 2));
                    return false;
                }
                while (frame.size > 0 && budget > 0) {
                    int run = frame.size - 1;
                    int len = frame.length[run];
                    // Take the run from its far end back, so a position touched
                    // twice inside one tick still ends on its earliest state.
                    int step = len - 1;
                    int px = frame.x[run] + (frame.axis[run] == AXIS_X ? step : 0);
                    int py = frame.y[run] + (frame.axis[run] == AXIS_Y ? step : 0);
                    int pz = frame.z[run] + (frame.axis[run] == AXIS_Z ? step : 0);
                    at.set(px, py, pz);

                    bounds[0] = Math.min(bounds[0], px);
                    bounds[1] = Math.min(bounds[1], py);
                    bounds[2] = Math.min(bounds[2], pz);
                    bounds[3] = Math.max(bounds[3], px);
                    bounds[4] = Math.max(bounds[4], py);
                    bounds[5] = Math.max(bounds[5], pz);

                    suppressed = true;
                    // Flag 2 again: neighbour updates across a restore this
                    // size cost more than the restore, and re-settling sand
                    // and water that were mid-fall is not wanted anyway.
                    world.setBlockState(at.toImmutable(), frame.was[run], 2);
                    suppressed = false;
                    budget--;

                    if (--len == 0) {
                        frame.size--;
                    } else {
                        frame.length[run] = (short) len;
                    }
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
