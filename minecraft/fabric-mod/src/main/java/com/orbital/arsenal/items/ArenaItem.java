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

/** Builds a stepped amphitheatre around you, sand floor and all. */
public class ArenaItem extends ArsenalItem {
    private static final int FLOOR = 16;
    private static final int ROWS = 8;
    private static final int COOLDOWN = 400;

    public ArenaItem(Settings settings) {
        super(settings, "Builds a stepped amphitheatre around you, sand floor and all.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int base = (int) Math.floor(user.getY()) - 1;
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§e◎ Building the arena."), true);
        Area.sweep(serverWorld, new Vec3d(cx, base, cz), FLOOR + ROWS * 2 + 2, ROWS + 8,
                FLOOR + ROWS * 2 + 2,
                (dx, dy, dz) -> dy >= 0 && dy <= ROWS + 8,
                ArenaItem::paint,
                () -> user.sendMessage(Text.literal("§e◎ Fight nicely."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /**
     * A sand floor, then a step up every two blocks out, then a lip. The rows
     * are computed from the radius rather than drawn one at a time, so the ring
     * is round at every height instead of only at the ones I checked.
     */
    private static BlockState paint(net.minecraft.server.world.ServerWorld world,
            BlockPos pos, BlockState was, int dx, int dy, int dz) {
        double r = Math.sqrt((double) dx * dx + (double) dz * dz);
        if (r <= FLOOR) {
            if (dy == 0) {
                return Blocks.SAND.getDefaultState();
            }
            return was.isAir() ? null : Blocks.AIR.getDefaultState();
        }
        int row = (int) ((r - FLOOR) / 2.0);
        if (row >= ROWS) {
            return null;
        }
        if (dy <= row) {
            return Blocks.SMOOTH_STONE.getDefaultState();
        }
        return was.isAir() ? null : Blocks.AIR.getDefaultState();
    }
}
