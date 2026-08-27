package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
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

/** Builds a sandstone pyramid, hollow, with a chamber inside it. */
public class PyramidItem extends Item {
    private static final int SIDE = 24;
    private static final int COOLDOWN = 400;

    public PyramidItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 130.0);
        user.sendMessage(Text.literal("§e▲ Building."), true);
        Area.sweep(serverWorld, at, SIDE, SIDE, SIDE,
                (dx, dy, dz) -> dy >= 0 && Math.max(Math.abs(dx), Math.abs(dz)) <= SIDE - dy,
                PyramidItem::paint,
                () -> user.sendMessage(Text.literal("§e▲ Four thousand years early."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /**
     * Shell and chamber only. A solid pyramid is twelve thousand blocks of
     * sandstone and nothing to find inside it.
     */
    private static BlockState paint(net.minecraft.server.world.ServerWorld world,
            BlockPos pos, BlockState was, int dx, int dy, int dz) {
        int edge = Math.max(Math.abs(dx), Math.abs(dz));
        int step = SIDE - dy;
        if (edge > step - 2) {
            return Math.floorMod(dx + dz + dy, 8) == 0
                    ? Blocks.CUT_SANDSTONE.getDefaultState()
                    : Blocks.SANDSTONE.getDefaultState();
        }
        // The chamber: a room at the base with a shaft up the middle.
        if (dy <= 6 && edge <= 5) {
            return (dy == 0 ? Blocks.CUT_SANDSTONE : Blocks.AIR).getDefaultState();
        }
        if (edge <= 1) {
            return Blocks.AIR.getDefaultState();
        }
        return null;
    }
}
