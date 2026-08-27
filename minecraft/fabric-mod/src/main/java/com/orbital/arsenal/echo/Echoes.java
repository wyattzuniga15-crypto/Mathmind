package com.orbital.arsenal.echo;

import com.orbital.arsenal.Scheduler;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;

/**
 * Ghosts that replay what you just did.
 *
 * Everyone's last ten seconds of movement is always being recorded, so pressing
 * the item produces a ghost *immediately* rather than starting a recording and
 * making you wait for it. That is the whole feel of the thing: you do something
 * worth watching, and then you watch yourself do it.
 *
 * Each ghost gets its own copy of the path at the moment it is made, so what you
 * do afterwards never changes what it is replaying — and two ghosts made ten
 * seconds apart are genuinely doing different things.
 */
public final class Echoes {
    /** How much of your past is kept, in ticks. */
    private static final int MEMORY = 200;
    /** How long a ghost lasts before it fades. */
    private static final int LIFETIME = 2400;
    /**
     * A ceiling per player. Both items exist to accumulate ghosts, and without
     * a cap the beacon would keep adding them all night until the server was
     * carrying a thousand entities nobody asked for.
     */
    private static final int MAX_GHOSTS = 24;

    /** One recorded moment: where you were, which way you faced, and how you were doing. */
    private record Frame(double x, double y, double z, float yaw, float pitch, float health) {}

    private static final class Ghost {
        final MobEntity body;
        final List<Frame> path;
        int index;
        int age;

        Ghost(MobEntity body, List<Frame> path) {
            this.body = body;
            this.path = path;
        }
    }

    // Keyed by UUID: a ServerPlayerEntity is replaced on respawn and on every
    // dimension change, so an entity-keyed map loses the entry when the player
    // dies, and holds the dead entity — and the world behind it — for the life
    // of the server.
    private static final Map<java.util.UUID, Deque<Frame>> MEMORIES = new java.util.HashMap<>();
    private static final Map<java.util.UUID, List<Ghost>> GHOSTS = new java.util.HashMap<>();

    private Echoes() {}

    /**
     * Make one ghost from the player's recent past.
     *
     * @return how many of their ghosts are now walking, or 0 if there was not
     *         yet enough recorded to replay
     */
    public static int spawn(ServerPlayerEntity player) {
        Deque<Frame> memory = MEMORIES.get(player.getUuid());
        if (memory == null || memory.size() < 20) {
            return 0;
        }
        ServerWorld world = player.getEntityWorld();
        MobEntity body = EntityType.VEX.create(world, SpawnReason.MOB_SUMMONED);
        if (body == null) {
            return 0;
        }

        List<Ghost> mine = GHOSTS.computeIfAbsent(player.getUuid(), key -> new ArrayList<>());
        if (mine.size() >= MAX_GHOSTS) {
            // Oldest out first, so the army stays the size it is rather than
            // simply refusing to grow.
            mine.remove(0).body.discard();
        }

        Frame first = memory.peekFirst();
        body.setPosition(first.x(), first.y(), first.z());
        body.setNoGravity(true);
        body.setInvulnerable(true);
        body.setGlowing(true);
        body.setCustomName(Text.literal("Echo of " + player.getName().getString()));
        world.spawnEntity(body);

        mine.add(new Ghost(body, new ArrayList<>(memory)));
        return mine.size();
    }

    /** How many ghosts this player currently has walking. */
    public static int count(ServerPlayerEntity player) {
        List<Ghost> mine = GHOSTS.get(player.getUuid());
        return mine == null ? 0 : mine.size();
    }

    /** Send them all away. */
    public static int dismiss(ServerPlayerEntity player) {
        List<Ghost> mine = GHOSTS.remove(player.getUuid());
        if (mine == null) {
            return 0;
        }
        for (Ghost ghost : mine) {
            ghost.body.discard();
        }
        return mine.size();
    }

    public static void tick(MinecraftServer server) {
        remember(server);
        replay(server);
    }

    private static void remember(MinecraftServer server) {
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            Deque<Frame> memory = MEMORIES.computeIfAbsent(player.getUuid(), key -> new ArrayDeque<>());
            memory.addLast(new Frame(player.getX(), player.getY(), player.getZ(),
                    player.getYaw(), player.getPitch(), player.getHealth()));
            while (memory.size() > MEMORY) {
                memory.removeFirst();
            }
        }
        // Prune against who is actually online. The keys are ids now, so
        // there is no entity to ask — and asking the entity was always the
        // thing that leaked it.
        java.util.Set<java.util.UUID> online = new java.util.HashSet<>();
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            online.add(player.getUuid());
        }
        MEMORIES.keySet().retainAll(online);
    }

    private static void replay(MinecraftServer server) {
        if (GHOSTS.isEmpty()) {
            return;
        }
        GHOSTS.values().forEach(mine -> mine.removeIf(ghost -> {
            if (++ghost.age > LIFETIME || ghost.body.isRemoved()) {
                ghost.body.discard();
                return true;
            }
            Frame frame = ghost.path.get(ghost.index);
            ghost.body.setPosition(frame.x(), frame.y(), frame.z());
            ghost.body.setYaw(frame.yaw());
            ghost.body.setPitch(frame.pitch());
            // Loop rather than stop at the end: a ghost that freezes after ten
            // seconds looks broken, one that starts its walk again looks haunted.
            ghost.index = (ghost.index + 1) % ghost.path.size();
            return false;
        }));
        java.util.Set<java.util.UUID> here = new java.util.HashSet<>();
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            here.add(player.getUuid());
        }
        GHOSTS.entrySet().removeIf(entry -> {
            if (!here.contains(entry.getKey())) {
                // Discard the bodies before dropping the entry, or the ghosts
                // stay in the world with nothing left that knows about them.
                entry.getValue().forEach(ghost -> ghost.body.discard());
                return true;
            }
            return false;
        });
    }

    /**
     * The oldest moment still remembered for this player, as
     * {x, y, z, yaw, pitch, health} — or null if there is not enough recorded
     * yet. This is what the Chronarch's Heart rewinds you to.
     */
    public static double[] furthestBack(ServerPlayerEntity player) {
        Deque<Frame> memory = MEMORIES.get(player.getUuid());
        if (memory == null || memory.size() < 20) {
            return null;
        }
        Frame frame = memory.peekFirst();
        return new double[] {frame.x(), frame.y(), frame.z(),
                frame.yaw(), frame.pitch(), frame.health()};
    }

    /** Used by the beacon to keep its own countdown in step with the tick loop. */
    public static void every(int ticks, Runnable work) {
        Scheduler.after(ticks, work);
    }
}
