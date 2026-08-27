package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Bores a lit tunnel straight ahead, two hundred blocks of it. */
public class TunnelBorerItem extends Item {
    private static final int LENGTH = 200;
    private static final int PER_TICK = 3;
    private static final int COOLDOWN = 300;

    public TunnelBorerItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        double flat = Math.sqrt(aim.x * aim.x + aim.z * aim.z);
        if (flat < 0.05) {
            user.sendMessage(Text.literal("§7Look along the ground first."), true);
            return ActionResult.SUCCESS;
        }
        // Snapped to an axis, like the rail layer: a tunnel cut on a diagonal is a
        // staircase of half-blocked doorways.
        int sx = Math.abs(aim.x) > Math.abs(aim.z) ? (aim.x > 0 ? 1 : -1) : 0;
        int sz = sx == 0 ? (aim.z > 0 ? 1 : -1) : 0;
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int feet = (int) Math.floor(user.getY());
        user.sendMessage(Text.literal("§7⌷ Boring."), true);
        int[] step = {1};
        Scheduler.repeat(() -> {
            for (int n = 0; n < PER_TICK && step[0] <= LENGTH; n++, step[0]++) {
                int px = cx + sx * step[0];
                int pz = cz + sz * step[0];
                for (int across = -1; across <= 1; across++) {
                    for (int up = 0; up <= 3; up++) {
                        BlockPos spot = new BlockPos(px + (-sz) * across, feet + up,
                                pz + sx * across);
                        BlockState was = serverWorld.getBlockState(spot);
                        if (!was.isAir() && !was.isOf(Blocks.BEDROCK)) {
                            Journal.clear(serverWorld, spot, was, Blocks.AIR.getDefaultState());
                        }
                    }
                }
                // A torch every eighth block, on the floor at the edge. The first
                // version put it two blocks up the wall — and the whole cross-section
                // including the block under it had just been cleared, so every torch
                // popped off the tick it was placed.
                if (step[0] % 8 == 0) {
                    BlockPos lamp = new BlockPos(px + (-sz), feet, pz + sx);
                    Journal.clear(serverWorld, lamp, serverWorld.getBlockState(lamp),
                            Blocks.TORCH.getDefaultState());
                }
            }
            if (step[0] <= LENGTH) {
                return true;
            }
            user.sendMessage(Text.literal("§7⌷ " + LENGTH + " blocks. Mind the drop."), true);
            return false;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
