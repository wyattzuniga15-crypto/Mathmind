package com.orbital.arsenal.weapons;

import com.orbital.arsenal.Scheduler;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import net.minecraft.entity.TntEntity;
import net.minecraft.server.world.ServerWorld;

/**
 * TNT that goes off when it lands rather than on a timer.
 *
 * A timed fuse cannot work for anything dropped over a wide area: the ground
 * under one edge of a 200-block ring can sit a hundred blocks below the other,
 * so a shell falling into a ravine is in the air several times as long as one
 * landing on a hilltop. Any single fuse length that suits one airbursts the
 * other — which is exactly what the cannon used to do.
 *
 * So shells get a fuse long enough that none of them ever reaches it, and one
 * watcher fires each shell the tick it touches down.
 */
public final class Shells {
    private static final int FUSE = 3000;
    /**
     * ...except a shell that never lands at all — dropped over the void, or
     * orphaned when its chunk unloaded. Fire those anyway, so a volley always
     * finishes instead of leaving live TNT lying about.
     */
    private static final int MAX_FLIGHT = 600;

    private static final class Shell {
        final TntEntity tnt;
        int age;

        Shell(TntEntity tnt) {
            this.tnt = tnt;
        }
    }

    /**
     * One watcher for every weapon that drops shells, rather than one per
     * volley — otherwise a weapon that fires continuously would stack up a
     * watcher per tick, all walking the same list.
     */
    private static final List<Shell> IN_FLIGHT = new ArrayList<>();
    private static boolean watching = false;

    private Shells() {}

    /** Drop one shell here. It detonates where it lands. */
    public static void drop(ServerWorld world, double x, double y, double z) {
        TntEntity tnt = new TntEntity(world, x, y, z, null);
        tnt.setFuse(FUSE);
        world.spawnEntity(tnt);
        IN_FLIGHT.add(new Shell(tnt));
        startWatching();
    }

    private static void startWatching() {
        if (watching) {
            return;
        }
        watching = true;
        Scheduler.repeat(() -> {
            Iterator<Shell> it = IN_FLIGHT.iterator();
            while (it.hasNext()) {
                Shell shell = it.next();
                if (++shell.age > MAX_FLIGHT || shell.tnt.isOnGround()) {
                    // One tick, not zero: a spent fuse still needs the entity
                    // to tick once more before it notices.
                    shell.tnt.setFuse(1);
                    it.remove();
                }
            }
            if (IN_FLIGHT.isEmpty()) {
                watching = false;
                return false;
            }
            return true;
        });
    }
}
