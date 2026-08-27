package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Sculpture;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Drops an enormous rubber duck, which leaves it a pond to sit in. */
public class GiantDuckItem extends ArsenalItem {
    private static final int REACH = 12;
    private static final int RADIUS = 26;
    private static final int DEPTH = 9;

    public GiantDuckItem(Settings settings) {
        super(settings, "Drops an enormous rubber duck, which leaves it a pond to sit in.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = com.orbital.arsenal.weapons.Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantDuckItem::paint, REACH, 80,
                "GIANT DUCK", (w, u, at) -> {
                    Sculpture.boom(w, at, 8.0F, 240);
                    // The crater is the point: a duck needs somewhere to float.
                    Sculpture.crater(w, at, RADIUS, DEPTH, () -> fill(w, u, at));
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), 200);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (Sculpture.blob(x, y, z, 0, 0, 0, 7, 5, 5)) {
            return y > -3 ? Blocks.YELLOW_CONCRETE : Blocks.WHITE_CONCRETE;
        }
        if (Sculpture.ball(x, y, z, 6, 6, 0, 3.6)) {
            // Eyes checked before the head, or the yellow would swallow them.
            if (Sculpture.ball(x, y, z, 8.2, 7.2, 1.6, 0.8)
                    || Sculpture.ball(x, y, z, 8.2, 7.2, -1.6, 0.8)) {
                return Blocks.BLACK_CONCRETE;
            }
            return Blocks.YELLOW_CONCRETE;
        }
        if (Sculpture.blob(x, y, z, 9.4, 5.2, 0, 2.4, 1.0, 1.8)) {
            return Blocks.ORANGE_CONCRETE;
        }
        if (Sculpture.blob(x, y, z, -7.5, 2.5, 0, 2.5, 2.0, 1.5)) {
            return Blocks.YELLOW_CONCRETE;
        }
        return null;
    }

    /** Flood the crater, bottom up, so it settles instead of pouring. */
    private static void fill(ServerWorld world, PlayerEntity user, Vec3d at) {
        int cx = (int) Math.floor(at.x);
        int cy = (int) Math.floor(at.y);
        int cz = (int) Math.floor(at.z);
        int[] dy = {-DEPTH};
        BlockState water = Blocks.WATER.getDefaultState();
        BlockPos.Mutable pos = new BlockPos.Mutable();

        Scheduler.repeat(() -> {
            if (dy[0] > -2) {
                user.sendMessage(Text.literal("§b🦆 One duck pond."), true);
                return false;
            }
            // Radius of the bowl at this depth, so the water meets the walls.
            double r = RADIUS * Math.sqrt(Math.max(0.0, 1.0 - (-dy[0]) / (double) DEPTH));
            int span = (int) r;
            for (int x = -span; x <= span; x++) {
                int half = (int) Math.sqrt(Math.max(0.0, r * r - (double) x * x));
                for (int z = -half; z <= half; z++) {
                    pos.set(cx + x, cy + dy[0], cz + z);
                    BlockState state = world.getBlockState(pos);
                    if (state.isAir()) {
                        Journal.clear(world, pos.toImmutable(), state, water);
                    }
                }
            }
            dy[0]++;
            return true;
        });
    }
}
