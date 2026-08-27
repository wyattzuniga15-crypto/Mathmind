package com.orbital.arsenal.time;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;

/**
 * The living half of the rewind: where things were standing, and what died.
 *
 * Blocks and mobs need completely different treatment, which is why this is
 * not part of Journal. A block only exists at a position, so replaying its
 * changes backwards restores it exactly. A mob is a moving thing that can also
 * stop existing — so putting one back means two separate jobs, undone in one
 * pass:
 *
 *   Position — where every surviving mob stood at the start of the window.
 *   Death    — everything that died inside the window, brought back.
 *
 * Both ride the window Journal is already keeping, and both run all the time,
 * so a creeper that blows up your pigs is as undoable as a black hole. The
 * sampling is what costs here rather than the deaths, which is why it runs a
 * few times a second rather than every tick and stops counting past a ceiling.
 */
public final class Souls {
    /**
     * Positions and deaths are kept for very different lengths of time, because
     * they cost very different amounts. A position sample is every entity in
     * the world several times a second; a death is one small record, and deaths
     * are rare. So the deep clocks can raise anything that died in the last
     * hour, while putting survivors back where they stood reaches only two
     * minutes — past that the samples would cost more memory than the block
     * record they accompany.
     */
    private static final int POSITION_WINDOW = 2_400;   // two minutes
    private static final int DEATH_WINDOW = 72_000;     // one hour
    /**
     * Positions are sampled every few ticks rather than every one. Where a mob
     * stood half a second either side of the truth is indistinguishable once
     * it is back on its feet, and sampling at a quarter of the rate costs a
     * quarter of the memory for the same result.
     */
    private static final int SAMPLE_EVERY = 4;
    /**
     * A hard ceiling on resurrections. The weapons here can kill a very large
     * number of mobs at once, and every one held costs memory until it ages
     * out of the window.
     */
    private static final int MAX_DEATHS = 20_000;
    /**
     * A ceiling on how many entities one snapshot will hold. Sampling runs
     * constantly now, so a world with a pathological number of entities — a mob
     * farm, an item flood — must not be able to turn this into the reason the
     * server is slow.
     */
    private static final int MAX_SAMPLED = 4000;

    /** Where a set of entities stood at one moment. */
    private static final class Snapshot {
        final int tick;
        final Entity[] who;
        final double[] xyz;

        Snapshot(int tick, Entity[] who, double[] xyz) {
            this.tick = tick;
            this.who = who;
            this.xyz = xyz;
        }
    }

    /** Everything needed to put one dead mob back. */
    private static final class Death {
        final int tick;
        final EntityType<?> type;
        final double x;
        final double y;
        final double z;
        final Text name;

        Death(int tick, EntityType<?> type, double x, double y, double z, Text name) {
            this.tick = tick;
            this.type = type;
            this.x = x;
            this.y = y;
            this.z = z;
            this.name = name;
        }
    }

    private static final class Record {
        final ArrayDeque<Snapshot> positions = new ArrayDeque<>();
        final ArrayDeque<Death> deaths = new ArrayDeque<>();
    }

    private static final Map<ServerWorld, Record> RECORDS = new IdentityHashMap<>();
    private static int now = 0;

    private Souls() {}

    /** File a death. Called from the mod's death hook for every mob that dies. */
    public static void died(LivingEntity entity) {
        // Players are deliberately left out. A player is put back by the game's
        // own respawn, with their inventory and their bed — quietly duplicating
        // one here would be worse than doing nothing.
        if (entity instanceof PlayerEntity) {
            return;
        }
        if (!(entity.getEntityWorld() instanceof ServerWorld world)) {
            return;
        }
        Record record = RECORDS.computeIfAbsent(world, key -> new Record());
        if (record.deaths.size() >= MAX_DEATHS) {
            record.deaths.pollFirst();
        }
        record.deaths.addLast(new Death(now, entity.getType(),
                entity.getX(), entity.getY(), entity.getZ(), entity.getCustomName()));
    }

    public static void tick(MinecraftServer server) {
        now++;
        for (ServerWorld world : server.getWorlds()) {
            Record record = RECORDS.computeIfAbsent(world, key -> new Record());
            if (now % SAMPLE_EVERY == 0) {
                sample(world, record);
            }
            trim(record);
        }
    }

    private static void sample(ServerWorld world, Record record) {
        List<Entity> found = new ArrayList<>();
        for (Entity entity : world.iterateEntities()) {
            // Players are left where they are. Yanking the person holding the
            // clock backwards through the world is not an undo, it is a shove.
            if (!(entity instanceof PlayerEntity)) {
                found.add(entity);
                if (found.size() >= MAX_SAMPLED) {
                    break;
                }
            }
        }
        Entity[] who = found.toArray(new Entity[0]);
        double[] xyz = new double[who.length * 3];
        for (int i = 0; i < who.length; i++) {
            xyz[i * 3] = who[i].getX();
            xyz[i * 3 + 1] = who[i].getY();
            xyz[i * 3 + 2] = who[i].getZ();
        }
        record.positions.addLast(new Snapshot(now, who, xyz));
    }

    private static void trim(Record record) {
        while (!record.positions.isEmpty()
                && now - record.positions.peekFirst().tick > POSITION_WINDOW) {
            record.positions.pollFirst();
        }
        while (!record.deaths.isEmpty() && now - record.deaths.peekFirst().tick > DEATH_WINDOW) {
            record.deaths.pollFirst();
        }
    }

    /**
     * Put the living world back as far as `windowTicks` reaches: survivors to
     * where they stood, the dead back on their feet.
     *
     * Anything older than the window is left where it is, so a shallow clock
     * cannot quietly consume what a deeper one would have restored.
     *
     * @return {moved, revived}
     */
    public static int[] rewind(ServerWorld world, int windowTicks) {
        Record record = RECORDS.get(world);
        if (record == null) {
            return new int[] {0, 0};
        }

        int moved = 0;
        // The oldest snapshot still inside the window. Walking every sample
        // back would end in the same place having done the work a hundred
        // times over.
        Snapshot oldest = null;
        for (Snapshot snapshot : record.positions) {
            if ((long) now - snapshot.tick <= windowTicks) {
                oldest = snapshot;
                break;
            }
        }
        if (oldest != null) {
            for (int i = 0; i < oldest.who.length; i++) {
                Entity entity = oldest.who[i];
                if (entity.isRemoved()) {
                    // It died inside the window; the death record brings it
                    // back, and moving a discarded entity does nothing.
                    continue;
                }
                entity.setPosition(oldest.xyz[i * 3], oldest.xyz[i * 3 + 1], oldest.xyz[i * 3 + 2]);
                moved++;
            }
            // Spent: a second rewind must not replay these and drag everything
            // back a second time.
            record.positions.removeIf(snapshot -> (long) now - snapshot.tick <= windowTicks);
        }

        int revived = 0;
        List<Death> raising = new ArrayList<>();
        for (Death death : record.deaths) {
            if ((long) now - death.tick <= windowTicks) {
                raising.add(death);
            }
        }
        for (Death death : raising) {
            Entity back = death.type.create(world, SpawnReason.EVENT);
            if (back == null) {
                continue;
            }
            back.setPosition(death.x, death.y, death.z);
            if (death.name != null) {
                back.setCustomName(death.name);
            }
            world.spawnEntity(back);
            revived++;
        }
        record.deaths.removeAll(raising);
        return new int[] {moved, revived};
    }
}
