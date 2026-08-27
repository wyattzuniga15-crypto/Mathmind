package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
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

/** Builds a one-room log cabin around you, window, torch and all. */
public class CabinItem extends Item {
    private static final int HALF = 5;
    private static final int TALL = 5;
    private static final int COOLDOWN = 300;

    public CabinItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int floorY = (int) Math.floor(user.getY()) - 1;
        user.sendMessage(Text.literal("§6⌂ Building."), true);
        Area.sweep(serverWorld, new Vec3d(cx, floorY, cz), HALF, TALL + HALF + 1, HALF,
                (dx, dy, dz) -> dy >= 0 && dy <= TALL + HALF + 1,
                CabinItem::paint,
                () -> user.sendMessage(Text.literal("§6⌂ Home."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /**
     * Floor, four walls, a pitched roof, a doorway and one window. No door and
     * no bed: both are blocks with a facing to get right, and a cabin with a
     * door hung the wrong way round is worse than an open doorway.
     */
    private static BlockState paint(net.minecraft.server.world.ServerWorld world,
            BlockPos pos, BlockState was, int dx, int dy, int dz) {
        int edge = Math.max(Math.abs(dx), Math.abs(dz));
        if (dy == 0) {
            return edge <= HALF ? Blocks.OAK_PLANKS.getDefaultState() : null;
        }
        if (dy > TALL) {
            // The roof: a step in from each side per course, up to a point. The
            // first version laid only the ring at each course, which is a roof
            // with a hole down the middle of it.
            int shrink = dy - TALL;
            int span = HALF - shrink + 1;
            if (edge == span) {
                return Blocks.DARK_OAK_PLANKS.getDefaultState();
            }
            return edge < span ? Blocks.AIR.getDefaultState() : null;
        }
        if (edge < HALF) {
            // Inside: cleared, with a torch in one corner.
            if (dy == 1 && dx == HALF - 1 && dz == HALF - 1) {
                return Blocks.TORCH.getDefaultState();
            }
            return was.isAir() ? null : Blocks.AIR.getDefaultState();
        }
        // The doorway, two tall, on the north wall.
        if (dz == -HALF && Math.abs(dx) <= 1 && dy <= 2) {
            return Blocks.AIR.getDefaultState();
        }
        // One window on each of the other three walls.
        if (dy == 3 && Math.abs(dx) <= 1 && dz == HALF) {
            return Blocks.GLASS.getDefaultState();
        }
        if (dy == 3 && Math.abs(dz) <= 1 && Math.abs(dx) == HALF) {
            return Blocks.GLASS.getDefaultState();
        }
        return Blocks.OAK_LOG.getDefaultState();
    }
}
