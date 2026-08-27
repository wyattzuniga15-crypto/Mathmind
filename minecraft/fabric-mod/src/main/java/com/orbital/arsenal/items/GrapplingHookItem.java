package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * Fires a line at whatever you are looking at and reels you to it.
 *
 * The pull is a velocity, not a teleport, so you arrive with momentum and can
 * chain shots into a swing. It is aimed slightly above the anchor because a
 * pull straight at a cliff face drags you into the wall and stops; aiming over
 * the lip carries you onto the top of it, which is what people mean.
 */
public class GrapplingHookItem extends ArsenalItem {
    private static final double RANGE = 60.0;
    private static final double PULL = 1.5;
    private static final double LIFT = 0.45;
    private static final int COOLDOWN = 12;

    public GrapplingHookItem(Settings settings) {
        super(settings, "Fires a line at whatever you are looking at and reels you to it.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        HitResult hit = user.raycast(RANGE, 1.0F, false);
        Vec3d anchor = hit.getPos();
        Vec3d from = new Vec3d(user.getX(), user.getY() + 1.4, user.getZ());
        Vec3d toward = anchor.subtract(from);
        double distance = toward.length();
        if (distance < 2.0) {
            return ActionResult.SUCCESS;
        }

        Vec3d pull = toward.normalize().multiply(PULL);
        // Up-weighted so a shot at a cliff face lands you on top of it rather
        // than flat against it. Scaled by distance: a long shot needs more
        // arc, a short one would be launched into orbit by the same amount.
        user.addVelocity(pull.x, pull.y + LIFT + Math.min(0.6, distance * 0.012), pull.z);

        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.PLAYERS, 1.0F, 1.4F);

        // Draw the rope for a moment so it reads as a line, not a shove.
        int steps = (int) distance;
        int[] frame = {0};
        Scheduler.repeat(() -> {
            for (int i = 0; i <= steps; i++) {
                Vec3d point = from.add(toward.multiply(i / (double) Math.max(1, steps)));
                serverWorld.spawnParticles(ParticleTypes.CRIT, true, true,
                        point.x, point.y, point.z, 1, 0.0, 0.0, 0.0, 0.0);
            }
            return ++frame[0] < 4;
        });

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
