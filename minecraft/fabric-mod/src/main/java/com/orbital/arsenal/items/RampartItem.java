package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
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

/** Raises a battlemented wall along your line of sight, with a walkway on top. */
public class RampartItem extends Item {
    private static final int LENGTH = 120;
    private static final int TALL = 8;
    private static final int PER_TICK = 2;
    private static final int COOLDOWN = 300;

    public RampartItem(Settings settings) {
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
        int sx = Math.abs(aim.x) > Math.abs(aim.z) ? (aim.x > 0 ? 1 : -1) : 0;
        int sz = sx == 0 ? (aim.z > 0 ? 1 : -1) : 0;
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int guess = (int) Math.floor(user.getY());
        user.sendMessage(Text.literal("§7▥ Raising the wall."), true);
        int[] step = {2};
        Scheduler.repeat(() -> {
            for (int n = 0; n < PER_TICK && step[0] <= LENGTH; n++, step[0]++) {
                int px = cx + sx * step[0];
                int pz = cz + sz * step[0];
                // Each course starts from the ground under that section, so the wall
                // follows a slope instead of floating off the side of a hill.
                int base = Area.surface(serverWorld, px, pz, guess);
                for (int across = -1; across <= 1; across++) {
                    for (int up = 1; up <= TALL; up++) {
                        boolean top = up == TALL;
                        // Crenellations: the merlons are on the outer courses only,
                        // and every other block, so the walkway between them is clear.
                        if (top && (across == 0 || step[0] % 2 == 1)) {
                            continue;
                        }
                        put(serverWorld, px + (-sz) * across, base + up, pz + sx * across,
                                Blocks.STONE_BRICKS.getDefaultState());
                    }
                }
            }
            if (step[0] <= LENGTH) {
                return true;
            }
            user.sendMessage(Text.literal("§7▥ " + LENGTH + " blocks of wall."), true);
            return false;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static void put(net.minecraft.server.world.ServerWorld world,
            int x, int y, int z, BlockState becomes) {
        BlockPos spot = new BlockPos(x, y, z);
        BlockState was = world.getBlockState(spot);
        if (was != becomes && !was.isOf(Blocks.BEDROCK)) {
            Journal.clear(world, spot, was, becomes);
        }
    }
}
