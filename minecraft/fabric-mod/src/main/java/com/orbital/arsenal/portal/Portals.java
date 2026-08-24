package com.orbital.arsenal.portal;

import java.util.IdentityHashMap;
import java.util.Map;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Direction;
import net.minecraft.util.math.Vec3d;

/**
 * A working pair of portals, in the sense the game Portal means it.
 *
 * The part that makes it a portal gun rather than a teleporter is momentum.
 * "Speedy thing goes in, speedy thing comes out": whatever speed you arrive
 * with is the speed you leave with, redirected along whatever way the far
 * portal faces. Fall thirty blocks into a portal in the floor and come out of
 * one in a wall, and you are fired sideways across the canyon at the speed the
 * fall gave you. A teleporter that dropped your velocity would look almost the
 * same and feel like nothing.
 */
public final class Portals {
    /** How close to a portal counts as entering it. */
    private static final double ENTRY = 1.1;
    /** How far out of the far portal you appear, so you do not instantly re-enter it. */
    private static final double EXIT_STEP = 1.4;
    /** Ticks before the same entity may use a portal again. */
    private static final int SETTLE = 12;
    /** Below this there is no momentum worth preserving, so it gets a nudge out instead. */
    private static final double MIN_EXIT_SPEED = 0.35;

    public record Portal(Vec3d at, Vec3d normal, ServerWorld world) {}

    private static final class Pair {
        Portal blue;
        Portal orange;
    }

    private static final Map<PlayerEntity, Pair> PAIRS = new IdentityHashMap<>();
    private static final Map<Entity, Integer> SETTLING = new IdentityHashMap<>();

    private Portals() {}

    public static void place(PlayerEntity owner, boolean orange, Portal portal) {
        Pair pair = PAIRS.computeIfAbsent(owner, key -> new Pair());
        if (orange) {
            pair.orange = portal;
        } else {
            pair.blue = portal;
        }
    }

    public static boolean linked(PlayerEntity owner) {
        Pair pair = PAIRS.get(owner);
        return pair != null && pair.blue != null && pair.orange != null;
    }

    public static void clear(PlayerEntity owner) {
        PAIRS.remove(owner);
    }

    public static void tick(MinecraftServer server) {
        if (PAIRS.isEmpty()) {
            return;
        }
        SETTLING.entrySet().removeIf(entry -> {
            int left = entry.getValue() - 1;
            entry.setValue(left);
            return left <= 0;
        });

        PAIRS.entrySet().removeIf(entry -> {
            PlayerEntity owner = entry.getKey();
            if (owner.isRemoved()) {
                return true;
            }
            Pair pair = entry.getValue();
            draw(pair.blue, ParticleTypes.SOUL_FIRE_FLAME);
            draw(pair.orange, ParticleTypes.FLAME);
            if (pair.blue != null && pair.orange != null) {
                carry(pair.blue, pair.orange);
                carry(pair.orange, pair.blue);
            }
            return false;
        });
    }

    /** Move anything standing in `from` out of `to`. */
    private static void carry(Portal from, Portal to) {
        ServerWorld world = from.world();
        Box mouth = new Box(
                from.at().x - ENTRY, from.at().y - ENTRY, from.at().z - ENTRY,
                from.at().x + ENTRY, from.at().y + ENTRY, from.at().z + ENTRY);
        for (Entity entity : world.getOtherEntities(null, mouth)) {
            if (SETTLING.containsKey(entity)) {
                continue;
            }
            send(entity, to);
            // Both ends, so arriving in the far portal cannot immediately count
            // as entering it and bounce the entity straight back.
            SETTLING.put(entity, SETTLE);
        }
    }

    private static void send(Entity entity, Portal to) {
        Vec3d exit = to.at().add(to.normal().multiply(EXIT_STEP));

        // The speed carried in becomes the speed carried out, pointed the way
        // the far portal faces. Standing still gets a gentle push instead, or
        // you would arrive stuck in the mouth of the exit.
        Vec3d velocity = entity.getVelocity();
        double speed = Math.max(MIN_EXIT_SPEED, velocity.length());
        Vec3d out = to.normal().multiply(speed);

        if (entity instanceof ServerPlayerEntity player) {
            // Players need the move sent to them: a server-side setPosition
            // leaves the client believing it is still where it was, and it
            // simply walks back.
            player.networkHandler.requestTeleport(exit.x, exit.y, exit.z);
        } else {
            entity.setPosition(exit.x, exit.y, exit.z);
        }
        entity.setVelocity(out);
        entity.addVelocity(0.0, 0.0, 0.0);

        to.world().spawnParticles(ParticleTypes.END_ROD, exit.x, exit.y, exit.z, 20, 0.4, 0.4, 0.4, 0.05);
    }

    /** Draw the ring so a portal is somewhere you can see rather than remember. */
    private static void draw(Portal portal, ParticleEffect colour) {
        if (portal == null) {
            return;
        }
        // Two directions across the portal's face, found from its normal. Any
        // pair perpendicular to it will do — the ring is round either way.
        Vec3d normal = portal.normal();
        Vec3d across = Math.abs(normal.y) > 0.9
                ? new Vec3d(1.0, 0.0, 0.0)
                : new Vec3d(0.0, 1.0, 0.0);
        Vec3d u = cross(normal, across).normalize();
        Vec3d v = cross(normal, u).normalize();

        for (int i = 0; i < 24; i++) {
            double angle = (i / 24.0) * Math.PI * 2.0;
            double wide = Math.cos(angle) * 0.95;
            double tall = Math.sin(angle) * 1.15;
            Vec3d point = portal.at()
                    .add(u.multiply(wide))
                    .add(v.multiply(tall));
            portal.world().spawnParticles(colour, point.x, point.y, point.z, 1, 0.0, 0.0, 0.0, 0.0);
        }
    }

    private static Vec3d cross(Vec3d a, Vec3d b) {
        return new Vec3d(
                a.y * b.z - a.z * b.y,
                a.z * b.x - a.x * b.z,
                a.x * b.y - a.y * b.x);
    }

    /** A block face's outward direction, as a unit vector. */
    public static Vec3d normalOf(Direction side) {
        return new Vec3d(side.getOffsetX(), side.getOffsetY(), side.getOffsetZ());
    }
}
