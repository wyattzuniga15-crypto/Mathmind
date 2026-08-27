package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.player.PlayerEntity;
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

/** Buries a charge where you stand. It waits for something to walk over it. */
public class LandmineItem extends ArsenalItem {
    private static final int ARMED_FOR = 6_000;
    private static final double TRIGGER = 3.0;
    private static final int COOLDOWN = 40;

    public LandmineItem(Settings settings) {
        super(settings, "Buries a charge where you stand. It waits for something to walk over it.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = new Vec3d(user.getX(), user.getY(), user.getZ());
        user.sendMessage(Text.literal("§8◉ Armed. Walk away."), true);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > ARMED_FOR) {
                return false;
            }
            // A grace period, or it goes off under the player who just placed it.
            if (age[0] < 40) {
                return true;
            }
            if (age[0] % 4 == 0) {
                serverWorld.spawnParticles(ParticleTypes.SMOKE, true, true,
                        at.x, at.y + 0.2, at.z, 1, 0.1, 0.0, 0.1, 0.0);
            }
            for (Entity thing : Area.living(serverWorld, null, at, TRIGGER)) {
                if (!(thing instanceof LivingEntity)) {
                    continue;
                }
                Strikes.blast(serverWorld, at, 9.0F);
                serverWorld.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                        at.x, at.y + 2, at.z, 200, 5.0, 3.0, 5.0, 0.2);
                return false;
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
