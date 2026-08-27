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

/** Everything around you crawls for twenty seconds. You do not. */
public class TimeBubbleItem extends ArsenalItem {
    private static final int DURATION = 400;
    private static final double REACH = 22.0;
    private static final int COOLDOWN = 300;

    public TimeBubbleItem(Settings settings) {
        super(settings, "Everything around you crawls for twenty seconds. You do not.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d here = new Vec3d(user.getX(), user.getY(), user.getZ());
        user.sendMessage(Text.literal("§b◷ Everything slows. Not you."), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.PLAYERS, 3.0F, 0.4F);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION) {
                user.sendMessage(Text.literal("§7◷ Normal speed."), true);
                return false;
            }
            // Damping velocity rather than freezing outright: a frozen mob snaps
            // back the instant it is released, while a damped one eases out of it.
            for (Entity thing : Area.living(serverWorld, user, here, REACH)) {
                Vec3d v = thing.getVelocity();
                thing.setVelocity(new Vec3d(v.x * 0.35, v.y * 0.8, v.z * 0.35));
            }
            if (age[0] % 6 == 0) {
                serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                        here.x, here.y + 2, here.z, 24, REACH * 0.4, 2.0, REACH * 0.4, 0.01);
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
