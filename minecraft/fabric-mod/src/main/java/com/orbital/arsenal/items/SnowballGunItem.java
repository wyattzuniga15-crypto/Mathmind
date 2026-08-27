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

/** A stream of snowballs, for as long as you can stand it. */
public class SnowballGunItem extends Item {
    private static final int SHOTS = 60;
    private static final double RANGE = 26.0;
    private static final int COOLDOWN = 100;

    public SnowballGunItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        user.sendMessage(Text.literal("§f❄ Rapid fire."), true);
        int[] shot = {0};
        Scheduler.repeat(() -> {
            if (++shot[0] > SHOTS || user.isRemoved()) {
                return false;
            }
            Vec3d aim = user.getRotationVec(1.0F).normalize();
            Vec3d muzzle = new Vec3d(user.getX(), user.getY() + 1.4, user.getZ());
            for (int i = 1; i <= (int) RANGE; i++) {
                Vec3d p = muzzle.add(aim.multiply(i));
                serverWorld.spawnParticles(ParticleTypes.SNOWFLAKE, true, true,
                        p.x, p.y, p.z, 2, 0.15, 0.15, 0.15, 0.02);
            }
            // Knock things back rather than hurt them: a snowball fight that killed
            // people would be a different item entirely.
            Area.shove(serverWorld, user, muzzle.add(aim.multiply(RANGE / 2)), RANGE / 2, 0.5);
            if (shot[0] % 4 == 0) {
                serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                        SoundCategory.PLAYERS, 0.6F, 1.9F);
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
