package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Digs a water-filled ring around you, with the bridge left in. */
public class MoatItem extends ArsenalItem {
    private static final int INNER = 14;
    private static final int OUTER = 20;
    private static final int DEEP = 6;
    private static final int COOLDOWN = 300;

    public MoatItem(Settings settings) {
        super(settings, "Digs a water-filled ring around you, with the bridge left in.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int rim = (int) Math.floor(user.getY()) - 1;
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§9≋ Digging."), true);
        Area.sweep(serverWorld, new Vec3d(cx, rim, cz), OUTER, DEEP + 6, OUTER,
                (dx, dy, dz) -> dy >= -DEEP && dy <= 6,
                MoatItem::paint,
                () -> user.sendMessage(Text.literal("§9≋ Moat. The bridge is north."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /**
     * The ring only, and one causeway left across it. A moat with no way over
     * it strands whoever dug it.
     */
    private static BlockState paint(net.minecraft.server.world.ServerWorld world,
            BlockPos pos, BlockState was, int dx, int dy, int dz) {
        double r = Math.sqrt((double) dx * dx + (double) dz * dz);
        if (r < INNER || r > OUTER) {
            return null;
        }
        if (Math.abs(dx) <= 2 && dz < 0) {
            return dy <= 0 ? Blocks.STONE_BRICKS.getDefaultState()
                    : (was.isAir() ? null : Blocks.AIR.getDefaultState());
        }
        if (dy > 0) {
            return was.isAir() ? null : Blocks.AIR.getDefaultState();
        }
        // A stone floor under the water, or it drains into whatever cave is
        // underneath and the moat is a dry ditch by morning.
        return dy == -DEEP ? Blocks.STONE_BRICKS.getDefaultState()
                : Blocks.WATER.getDefaultState();
    }
}
