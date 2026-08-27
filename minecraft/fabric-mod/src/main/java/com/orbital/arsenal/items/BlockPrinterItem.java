package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
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

/** Lays a floor of stone under you as you walk, thirty seconds' worth. */
public class BlockPrinterItem extends Item {
    private static final int DURATION = 600;
    private static final int COOLDOWN = 200;

    public BlockPrinterItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        user.sendMessage(Text.literal("§7▤ Printing. Walk."), true);
        int[] age = {0};
        BlockState floor = Blocks.STONE_BRICKS.getDefaultState();
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION || user.isRemoved()) {
                user.sendMessage(Text.literal("§7▤ Out of stone."), true);
                return false;
            }
            for (int dx = -1; dx <= 1; dx++) {
                for (int dz = -1; dz <= 1; dz++) {
                    BlockPos under = BlockPos.ofFloored(user.getX() + dx,
                            user.getY() - 0.6, user.getZ() + dz);
                    BlockState was = serverWorld.getBlockState(under);
                    // Only fills gaps: printing over the ground you are standing on
                    // would pave every path you have ever walked.
                    if (was.isAir() || was.isOf(Blocks.WATER) || was.isOf(Blocks.LAVA)) {
                        Journal.clear(serverWorld, under, was, floor);
                    }
                }
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
