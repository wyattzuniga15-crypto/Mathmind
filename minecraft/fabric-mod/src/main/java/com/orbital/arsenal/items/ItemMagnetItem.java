package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
import net.minecraft.entity.Entity;
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

/** Pulls every loose item and mob within forty blocks toward you for ten seconds. */
public class ItemMagnetItem extends ArsenalItem {
    private static final int DURATION = 200;
    private static final double REACH = 40.0;
    private static final int COOLDOWN = 200;

    public ItemMagnetItem(Settings settings) {
        super(settings, "Pulls every loose item and mob within forty blocks toward you for ten seconds.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        user.sendMessage(Text.literal("§e⌾ Magnet on"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.PLAYERS, 1.0F, 0.6F);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION || user.isRemoved()) {
                return false;
            }
            // Follows the player rather than a fixed point, so walking away does
            // not simply strand everything it had already picked up.
            Vec3d here = new Vec3d(user.getX(), user.getY() + 0.5, user.getZ());
            for (Entity thing : Area.living(serverWorld, user, here, REACH)) {
                double dx = here.x - thing.getX();
                double dy = here.y - thing.getY();
                double dz = here.z - thing.getZ();
                double d = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (d < 1.5) {
                    continue;
                }
                thing.addVelocity(dx / d * 0.28, dy / d * 0.28 + 0.03, dz / d * 0.28);
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
