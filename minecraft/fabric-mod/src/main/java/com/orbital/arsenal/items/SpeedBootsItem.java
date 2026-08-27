package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Thirty seconds of running much faster than you should. */
public class SpeedBootsItem extends ArsenalItem {
    private static final int DURATION = 600;
    private static final double BOOST = 0.22;
    private static final int COOLDOWN = 300;

    public SpeedBootsItem(Settings settings) {
        super(settings, "Thirty seconds of running much faster than you should.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        user.sendMessage(Text.literal("§f⇉ Fast. Thirty seconds."), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.PLAYERS, 1.0F, 1.7F);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION || user.isRemoved()) {
                user.sendMessage(Text.literal("§7⇉ Normal speed."), true);
                return false;
            }
            // Push along the way the player is already travelling, not the way they
            // are looking: boosting the look direction fights every turn they make.
            Vec3d v = user.getVelocity();
            double flat = Math.sqrt(v.x * v.x + v.z * v.z);
            if (flat > 0.05) {
                user.addVelocity(v.x / flat * BOOST, 0, v.z / flat * BOOST);
            }
            if (age[0] % 3 == 0) {
                serverWorld.spawnParticles(ParticleTypes.CLOUD, true, true,
                        user.getX(), user.getY() + 0.1, user.getZ(), 3, 0.2, 0.05, 0.2, 0.01);
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
