package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import java.util.concurrent.ThreadLocalRandom;
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

/** Thirty seconds of fireworks overhead, in every colour there is. */
public class FireworkShowItem extends Item {
    private static final int DURATION = 600;
    private static final int COOLDOWN = 300;

    public FireworkShowItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        user.sendMessage(Text.literal("§d✺ Enjoy the show."), true);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION || user.isRemoved()) {
                return false;
            }
            if (age[0] % 12 != 0) {
                return true;
            }
            ThreadLocalRandom dice = ThreadLocalRandom.current();
            double bx = user.getX() + dice.nextDouble(-24, 24);
            double bz = user.getZ() + dice.nextDouble(-24, 24);
            double by = user.getY() + 22 + dice.nextDouble(12);
            // A burst drawn as a shell of points rather than a cloud: random points
            // in a ball look like smoke, points on its surface look like a firework.
            for (int i = 0; i < 90; i++) {
                double phi = Math.acos(1 - 2 * (i + 0.5) / 90.0);
                double theta = Math.PI * (1 + Math.sqrt(5.0)) * i;
                double r = 3.5;
                serverWorld.spawnParticles(
                        (i % 3 == 0) ? ParticleTypes.FLAME
                                : (i % 3 == 1) ? ParticleTypes.END_ROD : ParticleTypes.CRIT,
                        true, true,
                        bx + Math.sin(phi) * Math.cos(theta) * r,
                        by + Math.cos(phi) * r,
                        bz + Math.sin(phi) * Math.sin(theta) * r,
                        1, 0.0, 0.0, 0.0, 0.0);
            }
            serverWorld.playSound(null, BlockPos.ofFloored(bx, by, bz),
                    SoundEvents.ENTITY_GENERIC_EXPLODE.value(), SoundCategory.AMBIENT, 3.0F, 1.6F);
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
