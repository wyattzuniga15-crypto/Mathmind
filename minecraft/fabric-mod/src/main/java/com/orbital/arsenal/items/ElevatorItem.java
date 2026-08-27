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

/** Raises a platform under you, forty blocks up, and rides it with you. */
public class ElevatorItem extends Item {
    private static final int RISE = 40;
    private static final int COOLDOWN = 120;

    public ElevatorItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int base = (int) Math.floor(user.getY());
        int[] up = {0};
        BlockState pad = Blocks.QUARTZ_BLOCK.getDefaultState();
        user.sendMessage(Text.literal("§f⇧ Going up."), true);
        Scheduler.repeat(() -> {
            if (up[0] >= RISE) {
                return false;
            }
            // Lift the player with the platform explicitly. Standing on a block
            // that appears under you does not move you — the game only pushes you
            // out of blocks, it does not carry you on them.
            for (int dx = -1; dx <= 1; dx++) {
                for (int dz = -1; dz <= 1; dz++) {
                    BlockPos at = new BlockPos(cx + dx, base + up[0] - 1, cz + dz);
                    BlockState was = serverWorld.getBlockState(at);
                    if (was.isAir()) {
                        Journal.clear(serverWorld, at, was, pad);
                    }
                }
            }
            user.setPosition(user.getX(), base + up[0], user.getZ());
            serverWorld.spawnParticles(ParticleTypes.CLOUD, true, true,
                    user.getX(), user.getY(), user.getZ(), 6, 0.6, 0.1, 0.6, 0.02);
            up[0] += 2;
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
