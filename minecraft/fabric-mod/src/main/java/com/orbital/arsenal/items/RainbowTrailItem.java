package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import net.minecraft.block.Block;
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

/** Leaves a trail of coloured blocks wherever you walk, for a minute. */
public class RainbowTrailItem extends Item {
    private static final int DURATION = 1_200;
    private static final int COOLDOWN = 200;

    public RainbowTrailItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Block[] colours = {Blocks.RED_CONCRETE, Blocks.ORANGE_CONCRETE, Blocks.YELLOW_CONCRETE,
                Blocks.PINK_CONCRETE, Blocks.WHITE_CONCRETE};
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 2.0F, 1.8F);
        user.sendMessage(Text.literal("§d≈ Leave a mark."), true);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION || user.isRemoved()) {
                return false;
            }
            BlockPos under = BlockPos.ofFloored(user.getX(), user.getY() - 0.6, user.getZ());
            BlockState was = serverWorld.getBlockState(under);
            // Only paints solid ground, and cycles on time rather than position, so
            // standing still still cycles and walking draws a band of each colour.
            if (!was.isAir()) {
                BlockState becomes = colours[(age[0] / 6) % colours.length].getDefaultState();
                if (was != becomes) {
                    Journal.clear(serverWorld, under, was, becomes);
                }
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
