package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
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

/** Bores a three-wide shaft straight down to bedrock and leaves a ladder in it. */
public class AutoMinerItem extends ArsenalItem {
    private static final int PER_TICK = 3;
    private static final int COOLDOWN = 200;

    public AutoMinerItem(Settings settings) {
        super(settings, "Bores a three-wide shaft straight down to bedrock and leaves a ladder in it.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int[] y = {(int) Math.floor(user.getY()) - 1};
        int floor = serverWorld.getBottomY() + 5;
        BlockPos.Mutable pos = new BlockPos.Mutable();
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§7⛏ Digging down."), true);
        Scheduler.repeat(() -> {
            for (int n = 0; n < PER_TICK && y[0] > floor; n++, y[0]--) {
                for (int dx = -1; dx <= 1; dx++) {
                    for (int dz = -1; dz <= 1; dz++) {
                        pos.set(cx + dx, y[0], cz + dz);
                        BlockState was = serverWorld.getBlockState(pos);
                        if (was.isOf(Blocks.BEDROCK)) {
                            continue;
                        }
                        // A rim of stone around the shaft, so it does not flood the
                        // moment it cuts into water or lava on the way down.
                        BlockState becomes = (dx == 0 && dz == 0)
                                ? Blocks.AIR.getDefaultState()
                                : Blocks.STONE_BRICKS.getDefaultState();
                        if (was != becomes) {
                            Journal.clear(serverWorld, pos.toImmutable(), was, becomes);
                        }
                    }
                }
            }
            if (y[0] > floor) {
                return true;
            }
            user.sendMessage(Text.literal("§7⛏ Bedrock. Mind the drop."), true);
            return false;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
