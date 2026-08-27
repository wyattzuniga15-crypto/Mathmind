package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
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

/** Turns the ground to sand that swallows whatever is standing on it. */
public class QuicksandItem extends ArsenalItem {
    private static final int RADIUS = 12;
    private static final int DURATION = 400;
    private static final int COOLDOWN = 200;

    public QuicksandItem(Settings settings) {
        super(settings, "Turns the ground to sand that swallows whatever is standing on it.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 100.0);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 3.0F, 1.4F);
        user.sendMessage(Text.literal("§e⌄ Sinking."), true);
        Area.column(serverWorld, at, RADIUS, 0, 6, (w, pos, was, dx, dy, dz) ->
                was.isAir() ? null : Blocks.SAND.getDefaultState(), null);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION) {
                return false;
            }
            for (Entity caught : Area.living(serverWorld, null, at, RADIUS)) {
                // Pulled down slowly rather than teleported under: the slow sink is
                // the whole effect, and it leaves time to scramble out.
                caught.addVelocity(0, -0.06, 0);
                // Downward velocity alone achieves nothing while the sand under
                // its feet is solid — it just presses into the floor. Every few
                // ticks, take that block away, and it descends for real.
                if (age[0] % 12 != 0 || !caught.isOnGround()) {
                    continue;
                }
                BlockPos under = BlockPos.ofFloored(caught.getX(), caught.getY() - 0.4, caught.getZ());
                BlockState was = serverWorld.getBlockState(under);
                if (was.isOf(Blocks.SAND)) {
                    Journal.clear(serverWorld, under, was, Blocks.AIR.getDefaultState());
                }
            }
            if (age[0] % 8 == 0) {
                serverWorld.spawnParticles(ParticleTypes.CLOUD, true, true,
                        at.x, at.y + 0.6, at.z, 20, RADIUS * 0.4, 0.2, RADIUS * 0.4, 0.02);
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
