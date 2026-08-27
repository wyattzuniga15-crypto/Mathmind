package com.orbital.arsenal.items;

import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.attribute.EntityAttributeInstance;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * Resizes whatever you point at. Click to shrink, sneak-click to grow.
 *
 * Both directions in one item because they are the same operation with the
 * factor inverted, and because a player who has shrunk something invariably
 * wants to put it back.
 */
public class ShrinkRayItem extends Item {
    private static final double RANGE = 40.0;
    private static final double STEP = 1.6;
    /** The scale attribute's own limits; outside them the game refuses. */
    private static final double SMALLEST = 0.0625;
    private static final double LARGEST = 16.0;
    private static final int COOLDOWN = 10;

    public ShrinkRayItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        LivingEntity target = lookingAt(serverWorld, user);
        if (target == null) {
            user.sendMessage(Text.literal("§7Nothing in the beam."), true);
            return ActionResult.SUCCESS;
        }

        EntityAttributeInstance scale = target.getAttributeInstance(EntityAttributes.SCALE);
        if (scale == null) {
            return ActionResult.SUCCESS;
        }
        boolean growing = user.isSneaking();
        double now = scale.getBaseValue();
        double next = growing ? now * STEP : now / STEP;
        next = Math.max(SMALLEST, Math.min(LARGEST, next));
        scale.setBaseValue(next);

        // Health follows size, or a giant dies like the animal it used to be.
        EntityAttributeInstance health = target.getAttributeInstance(EntityAttributes.MAX_HEALTH);
        if (health != null) {
            double before = target.getMaxHealth();
            health.setBaseValue(Math.max(2.0, 10.0 * next));
            double after = target.getMaxHealth();
            if (before > 0 && after > before) {
                target.setHealth((float) Math.min(after, target.getHealth() * (after / before)));
            }
        }

        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                target.getX(), target.getY() + next, target.getZ(), 30, 0.6, 0.6, 0.6, 0.05);
        serverWorld.playSound(null, target.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.PLAYERS, 1.0F, growing ? 0.6F : 1.8F);
        user.sendMessage(Text.literal(String.format(
                "§d✧ %s ×%.2f", growing ? "Grown to" : "Shrunk to", next)), true);

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private LivingEntity lookingAt(ServerWorld world, PlayerEntity user) {
        Vec3d eye = new Vec3d(user.getX(), user.getY() + 1.5, user.getZ());
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        for (double d = 1.0; d < RANGE; d += 1.0) {
            Vec3d probe = eye.add(aim.multiply(d));
            Box near = new Box(probe.x - 1.5, probe.y - 1.5, probe.z - 1.5,
                    probe.x + 1.5, probe.y + 1.5, probe.z + 1.5);
            for (Entity candidate : world.getOtherEntities(user, near)) {
                if (candidate instanceof LivingEntity living) {
                    return living;
                }
            }
        }
        return null;
    }
}
