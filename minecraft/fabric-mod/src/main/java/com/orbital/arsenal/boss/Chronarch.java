package com.orbital.arsenal.boss;

import com.orbital.arsenal.ModItems;
import com.orbital.arsenal.time.TimeControl;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.boss.BossBar;
import net.minecraft.entity.boss.ServerBossBar;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;

/**
 * A boss that fights you with time.
 *
 * Three phases, each turning one of this mod's own clocks against its owner:
 * it slows you while moving at full speed itself, and near the end it starts
 * rewinding its own wounds. The answer to that last phase is the Time Stop
 * Clock — a frozen world cannot rewind anything, including the Chronarch.
 *
 * On health: rather than fight the attribute API, the pool is kept here and
 * the body is topped back up. Each tick its health is compared with what it
 * was; the shortfall is the damage someone just dealt, that comes off the pool,
 * and the body is healed back to full. The effect is a boss with a thousand
 * hit points built from nothing but getHealth and setHealth, which have been
 * stable for many versions, instead of an attribute registry that has been
 * renamed twice recently.
 */
public final class Chronarch {
    private static final float POOL = 1000.0f;
    private static final double ARENA = 40.0;

    /** Phase thresholds, as a fraction of the pool remaining. */
    private static final float PHASE_TWO = 0.66f;
    private static final float PHASE_THREE = 0.33f;

    private static final int SLOW_EVERY = 40;
    private static final int REWIND_EVERY = 100;
    /** How much of the pool it claws back per rewind. Beatable, but only just. */
    private static final float REWIND_HEAL = 45.0f;

    private static final class Fight {
        final MobEntity body;
        final ServerWorld world;
        final ServerBossBar bar;
        final Construct shape;
        float pool = POOL;
        float lastSeen;
        int age;

        Fight(MobEntity body, ServerWorld world, ServerBossBar bar, Construct shape) {
            this.body = body;
            this.world = world;
            this.bar = bar;
            this.shape = shape;
            this.lastSeen = body.getMaxHealth();
        }
    }

    private static final List<Fight> FIGHTS = new ArrayList<>();

    private Chronarch() {}

    /** Wake one. Returns false if the body could not be made. */
    public static boolean summon(ServerWorld world, Vec3d at) {
        MobEntity body = EntityType.RAVAGER.create(world, SpawnReason.EVENT);
        if (body == null) {
            return false;
        }
        body.setPosition(at.x, at.y + 1.0, at.z);
        body.setCustomName(Text.literal("§5The Chronarch"));
        body.setCustomNameVisible(true);
        body.setHealth(body.getMaxHealth());
        // Invisible, but still the thing that walks at you and takes the hits.
        // What you see is the construct; what you fight is this.
        body.setInvisible(true);
        world.spawnEntity(body);

        Construct shape = Construct.assemble(world, at);
        if (shape == null) {
            body.discard();
            return false;
        }

        ServerBossBar bar = new ServerBossBar(
                Text.literal("§5The Chronarch"), BossBar.Color.PURPLE, BossBar.Style.NOTCHED_10);
        FIGHTS.add(new Fight(body, world, bar, shape));

        world.playSound(null, body.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 100.0F, 0.5F);
        return true;
    }

    public static void tick(MinecraftServer server) {
        if (FIGHTS.isEmpty()) {
            return;
        }
        FIGHTS.removeIf(Chronarch::run);
    }

    /** @return true when this fight is over and should be forgotten */
    private static boolean run(Fight fight) {
        if (fight.body.isRemoved()) {
            fight.bar.clearPlayers();
            fight.shape.dispel();
            return true;
        }
        fight.age++;

        // Damage is read as the drop in the body's own health since last tick,
        // then healed straight back. Nothing else has to know the pool exists.
        float now = fight.body.getHealth();
        if (now < fight.lastSeen) {
            fight.pool -= (fight.lastSeen - now);
            fight.body.setHealth(fight.body.getMaxHealth());
        }
        fight.lastSeen = fight.body.getMaxHealth();

        if (fight.pool <= 0.0f) {
            die(fight);
            return true;
        }

        float fraction = fight.pool / POOL;
        fight.bar.setPercent(Math.max(0.0f, fraction));
        // Every tick, so the rings turn smoothly rather than stepping.
        fight.shape.place(body(fight), fight.age, Math.max(0.0f, fraction));
        audience(fight);

        if (fraction <= PHASE_TWO && fight.age % SLOW_EVERY == 0) {
            dragOnTime(fight);
        }
        if (fraction <= PHASE_THREE && fight.age % REWIND_EVERY == 0) {
            rewind(fight);
        }
        return false;
    }

    /** Keep the bar in front of whoever is close enough to be fighting it. */
    private static void audience(Fight fight) {
        Box arena = near(fight, ARENA);
        fight.bar.clearPlayers();
        for (var entity : fight.world.getOtherEntities(fight.body, arena)) {
            if (entity instanceof ServerPlayerEntity player) {
                fight.bar.addPlayer(player);
            }
        }
    }

    /** Phase two: everyone else slows down. It does not. */
    private static void dragOnTime(Fight fight) {
        for (var entity : fight.world.getOtherEntities(fight.body, near(fight, ARENA))) {
            if (entity instanceof ServerPlayerEntity player) {
                player.addStatusEffect(new StatusEffectInstance(StatusEffects.SLOWNESS, 60, 2));
                player.sendMessage(Text.literal("§5the air thickens around you"), true);
            }
        }
        Vec3d at = body(fight);
        fight.world.spawnParticles(ParticleTypes.SOUL_FIRE_FLAME, true, true,
                at.x, at.y + 1.0, at.z, 60, 3.0, 2.0, 3.0, 0.01);
    }

    /**
     * Phase three: it undoes what you did to it.
     *
     * Unless time is stopped. A frozen world cannot rewind, and the Chronarch
     * is part of the world even if it does not behave like it — which makes the
     * Time Stop Clock the answer to this phase rather than a general-purpose
     * escape.
     */
    private static void rewind(Fight fight) {
        if (TimeControl.active()) {
            announce(fight, "§b⧗ the Chronarch reaches back — and finds nothing moving");
            return;
        }
        fight.pool = Math.min(POOL, fight.pool + REWIND_HEAL);
        announce(fight, "§5⟲ the Chronarch unmakes its wounds");
        Vec3d at = body(fight);
        fight.world.spawnParticles(ParticleTypes.END_ROD, true, true,
                at.x, at.y + 1.5, at.z, 80, 1.5, 2.0, 1.5, 0.06);
        fight.world.playSound(null, fight.body.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 4.0F, 0.6F);
    }

    private static void die(Fight fight) {
        Vec3d at = body(fight);
        fight.bar.clearPlayers();
        fight.shape.dispel();
        announce(fight, "§6✦ The Chronarch falls out of time");
        fight.world.playSound(null, fight.body.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 100.0F, 1.4F);
        fight.world.spawnParticles(ParticleTypes.END_ROD, true, true,
                at.x, at.y + 1.0, at.z, 200, 2.0, 2.0, 2.0, 0.3);

        ItemStack prize = new ItemStack(ModItems.CHRONARCH_HEART, 1);
        fight.world.spawnEntity(new ItemEntity(fight.world, at.x, at.y + 1.0, at.z, prize));
        fight.body.kill(fight.world);
    }

    private static void announce(Fight fight, String message) {
        for (var entity : fight.world.getOtherEntities(fight.body, near(fight, ARENA))) {
            if (entity instanceof ServerPlayerEntity player) {
                player.sendMessage(Text.literal(message), false);
            }
        }
    }

    private static Vec3d body(Fight fight) {
        LivingEntity body = fight.body;
        return new Vec3d(body.getX(), body.getY(), body.getZ());
    }

    private static Box near(Fight fight, double radius) {
        Vec3d at = body(fight);
        return new Box(at.x - radius, at.y - radius, at.z - radius,
                at.x + radius, at.y + radius, at.z + radius);
    }
}
