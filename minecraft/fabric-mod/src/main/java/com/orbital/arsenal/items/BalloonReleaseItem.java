package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
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

/** Two hundred balloons, released all at once, going up. */
public class BalloonReleaseItem extends ArsenalItem {
    private static final int BALLOONS = 200;
    private static final int PER_TICK = 8;
    private static final int DURATION = 400;
    private static final double SPREAD = 14.0;
    private static final int COOLDOWN = 300;

    public BalloonReleaseItem(Settings settings) {
        super(settings, "Two hundred balloons, released all at once, going up.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        user.sendMessage(Text.literal("§d◍ Let them go."), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 3.0F, 1.8F);
        double baseX = user.getX();
        double baseY = user.getY();
        double baseZ = user.getZ();
        // Drawn as particles rather than spawned as blocks or entities: two hundred
        // wool blocks rising would have to be two hundred falling-block entities
        // going the wrong way, and there is no such thing.
        double[] ax = new double[BALLOONS];
        double[] az = new double[BALLOONS];
        double[] rise = new double[BALLOONS];
        ThreadLocalRandom dice = ThreadLocalRandom.current();
        for (int i = 0; i < BALLOONS; i++) {
            ax[i] = dice.nextDouble(-SPREAD, SPREAD);
            az[i] = dice.nextDouble(-SPREAD, SPREAD);
            rise[i] = dice.nextDouble(0.18, 0.34);
        }
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION) {
                return false;
            }
            int shown = Math.min(BALLOONS, age[0] * PER_TICK);
            for (int i = 0; i < shown; i++) {
                double up = (age[0] - i / (double) PER_TICK) * rise[i];
                // Stop drawing one once it is out of sight, so the loop shrinks as
                // they go rather than redrawing two hundred dots forever.
                if (up < 0 || up > 90) {
                    continue;
                }
                double sway = Math.sin(age[0] * 0.06 + i) * 1.2;
                serverWorld.spawnParticles(ParticleTypes.GLOW, true, true,
                        baseX + ax[i] + sway, baseY + 1 + up, baseZ + az[i],
                        2, 0.12, 0.12, 0.12, 0.0);
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
