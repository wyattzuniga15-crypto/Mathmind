package com.orbital.arsenal;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * A plain tick queue. Weapons here are deliberately spread over many ticks —
 * a 200-block crater is over a million blocks, and doing that in one tick
 * would freeze the server outright.
 */
public final class Scheduler {
    private record Task(long dueTick, Runnable action) {}

    private static final List<Task> TASKS = new ArrayList<>();
    private static long now = 0L;

    private Scheduler() {}

    public static void after(int delayTicks, Runnable action) {
        TASKS.add(new Task(now + Math.max(0, delayTicks), action));
    }

    /**
     * Repeat `action` every tick until it returns false. Returning false is how
     * a job says it has finished, which lets the crater and the beam run for
     * however long they need without anyone counting ticks for them.
     */
    public static void repeat(java.util.function.BooleanSupplier action) {
        after(1, () -> {
            if (action.getAsBoolean()) {
                repeat(action);
            }
        });
    }

    static void tick() {
        now++;
        if (TASKS.isEmpty()) {
            return;
        }
        // Copy first: a task may schedule more work, and mutating the list
        // while iterating it would blow up.
        List<Task> due = new ArrayList<>();
        Iterator<Task> it = TASKS.iterator();
        while (it.hasNext()) {
            Task task = it.next();
            if (task.dueTick() <= now) {
                due.add(task);
                it.remove();
            }
        }
        for (Task task : due) {
            try {
                task.action().run();
            } catch (RuntimeException error) {
                OrbitalArsenal.LOGGER.error("scheduled task failed", error);
            }
        }
    }
}
