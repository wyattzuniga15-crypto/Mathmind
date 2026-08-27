package com.orbital.arsenal;

import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.attribute.EntityAttributeInstance;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;

/**
 * Cats that never stop growing.
 *
 * The size is not a number this class keeps — it is the cat's own scale
 * attribute, read back every second and multiplied. That matters more than it
 * sounds: an attribute is saved with the entity, so a cat is exactly as big
 * when you log back in, and carries on growing from there. Nothing has to be
 * written to disk, nothing has to be reloaded, and there is no second copy of
 * the truth to drift out of step with the first.
 *
 * Cats are found by a command tag rather than by a list, for the same reason.
 * Tags survive a restart and a chunk unload; a list in memory survives
 * neither, and a cat that stopped growing because you walked away would be a
 * strange kind of pet.
 */
public final class GrowingCats {
    public static final String TAG = "orbital_growing_cat";

    private static final double START = 0.3;
    /** The scale attribute's own ceiling. Past this the game refuses it. */
    private static final double MAX = 16.0;
    /** Fifteen minutes from kitten to colossal. */
    private static final int SECONDS_TO_FULL = 900;
    private static final int EVERY = 20;

    /**
     * Growth is multiplicative, not additive.
     *
     * Adding a fixed amount each second looks wrong: enormous early, when the
     * cat is small enough that a tenth of a block is half of it, and glacial
     * later. Multiplying by a constant is the shape growth actually has — the
     * cat gets bigger by the same *proportion* every second, so it reads as
     * steady the whole way up.
     */
    private static final double PER_SECOND = Math.pow(MAX / START, 1.0 / SECONDS_TO_FULL);

    /** How far away you can be and still be told about it. */
    private static final double EARSHOT = 48.0;

    private static int counter = 0;

    private GrowingCats() {}

    /** Set a newly spawned cat to kitten size and mark it as one of ours. */
    public static void adopt(LivingEntity cat) {
        cat.addCommandTag(TAG);
        size(cat, START);
    }

    /** Called every tick from the mod's tick hook; does its work once a second. */
    public static void tick(MinecraftServer server) {
        if (++counter < EVERY) {
            return;
        }
        counter = 0;

        for (ServerWorld world : server.getWorlds()) {
            for (Entity entity : world.iterateEntities()) {
                if (!(entity instanceof LivingEntity cat)
                        || !entity.getCommandTags().contains(TAG)) {
                    continue;
                }
                grow(world, cat);
            }
        }
    }

    private static void grow(ServerWorld world, LivingEntity cat) {
        EntityAttributeInstance scale = cat.getAttributeInstance(EntityAttributes.SCALE);
        if (scale == null) {
            return;
        }
        double was = scale.getBaseValue();
        if (was >= MAX) {
            return;
        }
        double now = Math.min(MAX, was * PER_SECOND);
        size(cat, now);

        // Announce only when it crosses into a new size, not every second —
        // a message a second for fifteen minutes is not a pet, it is spam.
        String before = name(was);
        String after = name(now);
        if (!before.equals(after)) {
            announce(world, cat, after, now);
        }
    }

    /**
     * Set the size, and the health that should go with it.
     *
     * A cat the size of a house that dies to one hit reads as a bug rather
     * than a joke, so health tracks the scale. The current health is moved by
     * the same proportion: raising the maximum alone would leave a colossal
     * cat sitting at ten hit points out of a hundred and sixty, looking
     * mortally wounded for no reason.
     */
    private static void size(LivingEntity cat, double scale) {
        EntityAttributeInstance size = cat.getAttributeInstance(EntityAttributes.SCALE);
        if (size != null) {
            size.setBaseValue(scale);
        }

        EntityAttributeInstance health = cat.getAttributeInstance(EntityAttributes.MAX_HEALTH);
        if (health != null) {
            double before = cat.getMaxHealth();
            health.setBaseValue(Math.max(10.0, 10.0 * scale));
            double after = cat.getMaxHealth();
            if (before > 0 && after > before) {
                cat.setHealth((float) Math.min(after, cat.getHealth() * (after / before)));
            }
        }
    }

    /** What to call a cat of this size. */
    private static String name(double scale) {
        if (scale < 0.5) {
            return "kitten";
        }
        if (scale < 1.0) {
            return "cat";
        }
        if (scale < 2.0) {
            return "big cat";
        }
        if (scale < 4.0) {
            return "huge cat";
        }
        if (scale < 8.0) {
            return "enormous cat";
        }
        if (scale < MAX) {
            return "titanic cat";
        }
        return "colossal cat";
    }

    private static void announce(ServerWorld world, LivingEntity cat, String what, double scale) {
        world.spawnParticles(ParticleTypes.HAPPY_VILLAGER, true, true,
                cat.getX(), cat.getY() + scale, cat.getZ(),
                (int) (12 * scale), scale, scale, scale, 0.02);
        world.playSound(null, cat.getBlockPos(), SoundEvents.ENTITY_CAT_PURREOW,
                SoundCategory.NEUTRAL, 2.0F, (float) Math.max(0.5, 1.4 - scale * 0.06));

        String note = scale >= MAX
                ? "§d🐈 Your cat is fully grown. It is a " + what + "."
                : "§d🐈 Your cat is now a " + what + ".";
        for (ServerPlayerEntity player : world.getPlayers()) {
            double dx = player.getX() - cat.getX();
            double dz = player.getZ() - cat.getZ();
            if (dx * dx + dz * dz <= EARSHOT * EARSHOT) {
                player.sendMessage(Text.literal(note), true);
            }
        }
    }
}
