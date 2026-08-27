package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import java.util.HashMap;
import java.util.Map;
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

/** Freezes the water under your feet as you cross it. Thaws behind you. */
public class WaterWalkingItem extends ArsenalItem {
    private static final int DURATION = 800;
    private static final int COOLDOWN = 200;

    public WaterWalkingItem(Settings settings) {
        super(settings, "Freezes the water under your feet as you cross it. Thaws behind you.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        user.sendMessage(Text.literal("§b≋ Walk on."), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_GLASS_BREAK,
                SoundCategory.PLAYERS, 1.0F, 1.5F);
        Map<BlockPos, Integer> frozen = new HashMap<>();
        int[] age = {0};
        BlockState ice = Blocks.PACKED_ICE.getDefaultState();
        Scheduler.repeat(() -> {
            age[0]++;
            boolean over = age[0] > DURATION || user.isRemoved();
            if (!over) {
                for (int dx = -2; dx <= 2; dx++) {
                    for (int dz = -2; dz <= 2; dz++) {
                        BlockPos under = BlockPos.ofFloored(user.getX() + dx,
                                user.getY() - 0.5, user.getZ() + dz);
                        BlockState was = serverWorld.getBlockState(under);
                        if (was.isOf(Blocks.WATER)) {
                            Journal.clear(serverWorld, under, was, ice);
                            frozen.put(under, age[0]);
                        }
                    }
                }
            }
            // Thaw behind: a permanent ice bridge across every lake is not what
            // walking on water means, and it would never be cleaned up.
            frozen.entrySet().removeIf(entry -> {
                if (!over && age[0] - entry.getValue() < 60) {
                    return false;
                }
                BlockState now = serverWorld.getBlockState(entry.getKey());
                if (now.isOf(Blocks.PACKED_ICE)) {
                    Journal.clear(serverWorld, entry.getKey(), now, Blocks.WATER.getDefaultState());
                }
                return true;
            });
            return !over || !frozen.isEmpty();
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
