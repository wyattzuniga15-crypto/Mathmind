package com.orbital.arsenal.time;

import com.orbital.arsenal.Scheduler;
import net.minecraft.server.MinecraftServer;

/**
 * Freezing and slowing the world.
 *
 * Both ride Minecraft's own tick manager — the machinery behind `/tick freeze`
 * and `/tick rate` — rather than anything invented here. That matters most for
 * the freeze: vanilla's freeze already exempts players by design, so you keep
 * walking, mining and swinging while everything else stops dead. Reimplementing
 * that by hand would mean finding and pausing every mob, projectile, falling
 * block, fluid, redstone circuit and block entity in the world, and getting one
 * of them wrong is a mob that keeps coming for you while time is stopped.
 *
 * Only one effect runs at a time. Freezing on top of a slowdown would leave the
 * tick rate to be put back by whichever timer happened to fire last, and the
 * failure mode there is a world stuck at a fifth speed with no way back.
 */
public final class TimeControl {
    public static final float NORMAL_RATE = 20.0f;

    private static boolean active = false;
    /**
     * Bumped every time an effect starts or is released early. A pending
     * restore checks it before firing, which is how an early release cancels
     * the timer it was scheduled with — the Scheduler has no cancel of its own.
     */
    private static int generation = 0;

    private TimeControl() {}

    public static boolean active() {
        return active;
    }

    /** Stop everything but the players. Returns false if time is already altered. */
    public static boolean freeze(MinecraftServer server, int seconds) {
        if (active) {
            return false;
        }
        active = true;
        int mine = ++generation;
        server.getTickManager().setFrozen(true);
        // A frozen server still runs its own loop at twenty ticks a second —
        // it is the world that stops, not the server — so plain tick maths
        // gets the countdown right here.
        Scheduler.after(seconds * 20, () -> {
            if (mine == generation) {
                restore(server);
            }
        });
        return true;
    }

    /** Run the world at a fraction of normal speed. Returns false if time is already altered. */
    public static boolean slow(MinecraftServer server, int seconds, float rate) {
        if (active) {
            return false;
        }
        active = true;
        int mine = ++generation;
        server.getTickManager().setTickRate(rate);
        // The Scheduler counts server ticks, and those now arrive `rate` times
        // a second rather than twenty. Waiting the usual number of ticks would
        // stretch a ten-second slowdown into fifty, so the wait is measured on
        // the slowed clock instead.
        int ticks = Math.max(1, Math.round(seconds * rate));
        Scheduler.after(ticks, () -> {
            if (mine == generation) {
                restore(server);
            }
        });
        return true;
    }

    /** Put time back now, cancelling whatever was pending. Returns false if nothing was altered. */
    public static boolean release(MinecraftServer server) {
        if (!active) {
            return false;
        }
        generation++;
        restore(server);
        return true;
    }

    private static void restore(MinecraftServer server) {
        server.getTickManager().setFrozen(false);
        server.getTickManager().setTickRate(NORMAL_RATE);
        active = false;
    }
}
