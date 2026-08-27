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

/** Cuts a lit spiral staircase from your feet down to bedrock. */
public class MineshaftItem extends Item {
    private static final int RADIUS = 4;
    private static final int PER_TICK = 2;
    private static final int COOLDOWN = 300;

    public MineshaftItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int top = (int) Math.floor(user.getY());
        int floorY = serverWorld.getBottomY() + 5;
        user.sendMessage(Text.literal("§7⇩ Digging down."), true);
        int[] y = {top};
        Scheduler.repeat(() -> {
            for (int n = 0; n < PER_TICK; n++) {
                if (y[0] <= floorY) {
                    user.sendMessage(Text.literal("§7⇩ Bedrock. Mind the step."), true);
                    return false;
                }
                // One turn of the spiral every sixteen blocks of depth.
                double a = (top - y[0]) * Math.PI / 8.0;
                int sx = cx + (int) Math.round(Math.cos(a) * RADIUS);
                int sz = cz + (int) Math.round(Math.sin(a) * RADIUS);
                for (int dx = -1; dx <= 1; dx++) {
                    for (int dz = -1; dz <= 1; dz++) {
                        for (int up = 1; up <= 3; up++) {
                            cut(serverWorld, sx + dx, y[0] + up, sz + dz);
                        }
                        BlockPos tread = new BlockPos(sx + dx, y[0], sz + dz);
                        BlockState was = serverWorld.getBlockState(tread);
                        if (was.isAir()) {
                            Journal.clear(serverWorld, tread, was, Blocks.COBBLESTONE.getDefaultState());
                        }
                    }
                }
                if ((top - y[0]) % 6 == 0) {
                    BlockPos lamp = new BlockPos(sx, y[0] + 1, sz);
                    BlockState was = serverWorld.getBlockState(lamp);
                    Journal.clear(serverWorld, lamp, was, Blocks.TORCH.getDefaultState());
                }
                y[0]--;
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static void cut(net.minecraft.server.world.ServerWorld world, int x, int y, int z) {
        BlockPos spot = new BlockPos(x, y, z);
        BlockState was = world.getBlockState(spot);
        // Never cut a tread. The headroom for one step runs straight through
        // the stair the step above just laid, and without this the whole
        // spiral came out as a shaft with nothing to stand on.
        if (was.isOf(Blocks.COBBLESTONE)) {
            return;
        }
        if (!was.isAir() && !was.isOf(Blocks.BEDROCK)) {
            Journal.clear(world, spot, was, Blocks.AIR.getDefaultState());
        }
    }
}
