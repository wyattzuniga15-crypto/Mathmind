package com.orbital.arsenal.companion;

import java.util.HashMap;
import java.util.Map;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.math.Vec3d;

/**
 * One player's companion: a body, a destination, and nothing else.
 *
 * The body is a vanilla allay, chosen for two practical reasons rather than
 * looks. It flies, so it never gets stuck on terrain the way a walking mob
 * does — and a companion that strands itself behind a hill is worse than no
 * companion. And it is small enough to follow you indoors.
 *
 * Everything the companion *does* is performed by mod code at the body's
 * position, never by the mob itself, so the choice of body only affects how it
 * looks and moves. That is also why movement here is a plain glide toward a
 * target rather than pathfinding: for a flying body it looks the same and
 * cannot fail.
 */
public final class Companion {
    private static final Map<ServerPlayerEntity, Companion> BY_PLAYER = new HashMap<>();

    private static final double SPEED = 0.55;      // blocks per tick
    private static final double FOLLOW_GAP = 3.5;  // how close it trails you
    private static final double ARRIVED = 1.2;

    private final ServerPlayerEntity owner;
    private final MobEntity body;
    private boolean following = true;
    private Vec3d destination;

    private Companion(ServerPlayerEntity owner, MobEntity body) {
        this.owner = owner;
        this.body = body;
    }

    public static Companion of(ServerPlayerEntity player) {
        return BY_PLAYER.get(player);
    }

    /** Summon one, replacing any the player already has. */
    public static Companion summon(ServerPlayerEntity player, String name) {
        dismiss(player);
        ServerWorld world = player.getEntityWorld();
        MobEntity body = EntityType.ALLAY.create(world, SpawnReason.MOB_SUMMONED);
        if (body == null) {
            return null;
        }
        body.setPosition(player.getX(), player.getY() + 2.0, player.getZ());
        body.setNoGravity(true);
        body.setCustomName(Text.literal(name));
        body.setCustomNameVisible(true);
        body.setInvulnerable(true);
        world.spawnEntity(body);

        Companion companion = new Companion(player, body);
        BY_PLAYER.put(player, companion);
        return companion;
    }

    public static void dismiss(ServerPlayerEntity player) {
        Companion existing = BY_PLAYER.remove(player);
        if (existing != null) {
            existing.body.discard();
        }
    }

    public ServerPlayerEntity owner() {
        return owner;
    }

    public MobEntity body() {
        return body;
    }

    public Vec3d position() {
        return new Vec3d(body.getX(), body.getY(), body.getZ());
    }

    public ServerWorld world() {
        return owner.getEntityWorld();
    }

    public void follow() {
        following = true;
        destination = null;
    }

    public void stay() {
        following = false;
        destination = null;
    }

    public void goTo(Vec3d target) {
        following = false;
        destination = target;
    }

    public String state() {
        if (following) {
            return "following you";
        }
        return destination == null ? "holding position" : "travelling";
    }

    /** Glide one tick toward wherever it is currently meant to be. */
    private void move() {
        Vec3d target = destination;
        if (following) {
            // Trail behind rather than sitting on top of the player, so it
            // stays visible instead of clipping through your own head.
            Vec3d toOwner = new Vec3d(owner.getX(), owner.getY() + 1.5, owner.getZ())
                    .subtract(position());
            double distance = toOwner.length();
            if (distance <= FOLLOW_GAP) {
                return;
            }
            target = position().add(toOwner.normalize().multiply(distance - FOLLOW_GAP));
        }
        if (target == null) {
            return;
        }
        Vec3d delta = target.subtract(position());
        double distance = delta.length();
        if (distance < ARRIVED) {
            destination = null;
            return;
        }
        Vec3d step = delta.normalize().multiply(Math.min(SPEED, distance));
        body.setPosition(body.getX() + step.x, body.getY() + step.y, body.getZ() + step.z);
    }

    /** Drive every live companion; called once a tick from the mod entrypoint. */
    public static void tickAll() {
        if (BY_PLAYER.isEmpty()) {
            return;
        }
        BY_PLAYER.entrySet().removeIf(entry -> {
            Companion companion = entry.getValue();
            // A logged-out owner or a body that has gone leaves nothing to
            // drive, and holding the reference would leak the player object.
            if (entry.getKey().isRemoved() || companion.body.isRemoved()) {
                companion.body.discard();
                return true;
            }
            companion.move();
            return false;
        });
    }
}
