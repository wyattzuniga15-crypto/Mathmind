package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
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
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** A pocket singularity. Drags everything nearby inward for eight seconds, then lets go. */
public class BlackHoleGrenadeItem extends Item {
    private static final int LIFETIME = 160;
    private static final double REACH = 26.0;
    private static final double PULL = 0.22;
    private static final int COOLDOWN = 200;

    public BlackHoleGrenadeItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 100.0);
        user.sendMessage(Text.literal("§8● Singularity — eight seconds"), true);
        serverWorld.playSound(null, BlockPos.ofFloored(at), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 8.0F, 0.3F);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > LIFETIME) {
                return false;
            }
            for (Entity thing : Area.living(serverWorld, null, at, REACH)) {
                double dx = at.x - thing.getX();
                double dy = at.y - thing.getY();
                double dz = at.z - thing.getZ();
                double d = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (d < 0.5) {
                    continue;
                }
                // Stronger the closer you get, which is what makes escaping it a
                // decision rather than a formality.
                double grip = PULL * (1.0 - Math.min(0.9, d / REACH)) / d;
                thing.addVelocity(dx * grip, dy * grip, dz * grip);
            }
            for (int i = 0; i < 12; i++) {
                double a = age[0] * 0.3 + i * 0.52;
                double r = 6.0 - (age[0] % 40) * 0.12;
                serverWorld.spawnParticles(ParticleTypes.SOUL_FIRE_FLAME, true, true,
                        at.x + Math.cos(a) * r, at.y + Math.sin(a * 1.7) * 2, at.z + Math.sin(a) * r,
                        1, 0.0, 0.0, 0.0, 0.0);
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
