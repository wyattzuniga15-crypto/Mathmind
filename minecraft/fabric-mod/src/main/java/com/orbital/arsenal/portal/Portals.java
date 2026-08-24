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

    private static final int RING_POINTS = 40;
    private static final int INNER_POINTS = 12;
    private static final double RING_WIDE = 0.95;
    private static final double RING_TALL = 1.2;
    /** Redraw rate. These particles linger, so a few times a second looks solid. */
    private static final int DRAW_EVERY = 4;

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
        // Draw it at once rather than waiting for the next redraw, so shooting
        // a portal and seeing one happen together.
        draw(portal, orange ? ParticleTypes.FLAME : ParticleTypes.SOUL_FIRE_FLAME, 0);
        portal.world().spawnParticles(ParticleTypes.END_ROD, true, true,
                portal.at().x, portal.at().y, portal.at().z, 30, 0.5, 0.6, 0.5, 0.02);
    }

    public static boolean linked(PlayerEntity owner) {
        Pair pair = PAIRS.get(owner);
        return pair != null && pair.blue != null && pair.orange != null;
    }

    public static void clear(PlayerEntity owner) {
        PAIRS.remove(owner);
    }

    private static int now = 0;

    public static void tick(MinecraftServer server) {
        if (PAIRS.isEmpty()) {
            return;
        }
        now++;
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
            if (now % DRAW_EVERY == 0) {
                draw(pair.blue, ParticleTypes.SOUL_FIRE_FLAME, now);
                draw(pair.orange, ParticleTypes.FLAME, now);
            }
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
            // Carrying the player's own yaw and pitch through: a portal moves
            // you, it does not spin you round to face somewhere new.
            player.networkHandler.requestTeleport(
                    exit.x, exit.y, exit.z, player.getYaw(), player.getPitch());
        } else {
            entity.setPosition(exit.x, exit.y, exit.z);
        }
        entity.setVelocity(out);
        entity.addVelocity(0.0, 0.0, 0.0);

        to.world().spawnParticles(ParticleTypes.END_ROD, true, true,
                exit.x, exit.y, exit.z, 20, 0.4, 0.4, 0.4, 0.05);
    }

    /**
     * Draw a portal so it can actually be seen.
     *
     * Two things were making these near-invisible. Ordinary particles are
     * culled by the client at about 32 blocks, so a portal placed across a
     * valley simply was not sent — the forced flag is what /particle force uses
     * to override that, and it is the difference between seeing a portal you
     * shot at a distant cliff and having to walk to it.
     *
     * And drawing one packet per ring point every tick meant hundreds a second
     * per portal, which the client throttles. These particles linger for a
     * couple of seconds, so the ring is redrawn a few times a second instead
     * and still looks continuous — fewer packets and a denser ring at once.
     */
    private static void draw(Portal portal, ParticleEffect colour, int phase) {
        if (portal == null) {
            return;
        }
        // Two directions across the portal's face, found from its normal. Any
        // pair perpendicular to it will do — the ring is round either way.
        Vec3d normal = portal.normal();
        Vec3d seed = Math.abs(normal.y) > 0.9
                ? new Vec3d(1.0, 0.0, 0.0)
                : new Vec3d(0.0, 1.0, 0.0);
        Vec3d u = cross(normal, seed).normalize();
        Vec3d v = cross(normal, u).normalize();
        ServerWorld world = portal.world();

        for (int i = 0; i < RING_POINTS; i++) {
            double angle = ((i + phase * 0.35) / RING_POINTS) * Math.PI * 2.0;
            Vec3d point = portal.at()
                    .add(u.multiply(Math.cos(angle) * RING_WIDE))
                    .add(v.multiply(Math.sin(angle) * RING_TALL));
            world.spawnParticles(colour, true, true, point.x, point.y, point.z, 1, 0.0, 0.0, 0.0, 0.0);
        }

        // A few motes across the opening as well, so it reads as a surface you
        // could step through rather than a hoop drawn in the air.
        for (int i = 0; i < INNER_POINTS; i++) {
            double angle = ((i * 2.4) + phase * 0.6);
            double spread = 0.35 + 0.5 * ((i % 3) / 3.0);
            Vec3d point = portal.at()
                    .add(u.multiply(Math.cos(angle) * RING_WIDE * spread))
                    .add(v.multiply(Math.sin(angle) * RING_TALL * spread));
            world.spawnParticles(ParticleTypes.END_ROD, true, true,
                    point.x, point.y, point.z, 1, 0.0, 0.0, 0.0, 0.0);
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
