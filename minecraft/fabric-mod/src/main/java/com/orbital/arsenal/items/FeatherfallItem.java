package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Everything nearby falls like a feather for a minute, including you. */
public class FeatherfallItem extends Item {
    private static final int DURATION = 1200;
    private static final double REACH = 30.0;
    private static final int COOLDOWN = 300;

    public FeatherfallItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 1.5F, 1.8F);
        user.sendMessage(Text.literal("§f❋ Slow falling, everything."), true);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (user.isRemoved()) {
                return false;
            }
            if (++age[0] > DURATION) {
                user.sendMessage(Text.literal("§7❋ Gravity is back."), true);
                return false;
            }
            Vec3d here = new Vec3d(user.getX(), user.getY(), user.getZ());
            for (Entity thing : Area.living(serverWorld, null, here, REACH)) {
                Vec3d v = thing.getVelocity();
                // Only damps downward motion. Damping upward too would stop anything
                // jumping, which is not what falling slowly means.
                if (v.y < -0.12) {
                    thing.setVelocity(new Vec3d(v.x, v.y * 0.55, v.z));
                }
            }
            if (age[0] % 10 == 0) {
                serverWorld.spawnParticles(ParticleTypes.CLOUD, true, true,
                        user.getX(), user.getY() + 1, user.getZ(), 8, REACH * 0.3, 2.0, REACH * 0.3, 0.01);
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
