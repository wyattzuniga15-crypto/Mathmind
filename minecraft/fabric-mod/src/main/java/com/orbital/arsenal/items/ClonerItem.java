package com.orbital.arsenal.items;

import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
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

/** Copies a chunk of the world in front of you and stamps it down beside itself. */
public class ClonerItem extends Item {
    private static final int HALF = 10;
    private static final int COOLDOWN = 300;

    public ClonerItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 100.0);
        int cx = (int) Math.floor(at.x);
        int cy = (int) Math.floor(at.y);
        int cz = (int) Math.floor(at.z);
        int shift = HALF * 2 + 2;
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§d⧉ Copying."), true);
        // Read the whole source first, then write. Reading and writing in one pass
        // copies blocks the same pass has already changed, which smears the source
        // across the copy when the two overlap.
        final BlockState[] taken = new BlockState[(HALF * 2 + 1) * (HALF * 2 + 1) * (HALF * 2 + 1)];
        int i = 0;
        for (int dx = -HALF; dx <= HALF; dx++) {
            for (int dy = -HALF; dy <= HALF; dy++) {
                for (int dz = -HALF; dz <= HALF; dz++) {
                    taken[i++] = serverWorld.getBlockState(new BlockPos(cx + dx, cy + dy, cz + dz));
                }
            }
        }
        // The write goes through Area so it is spread over ticks: nine thousand
        // block changes at once is the stall the budget exists to prevent, and
        // this copies more than that.
        int side = HALF * 2 + 1;
        Area.sweep(serverWorld, new Vec3d(cx + shift, cy, cz), HALF, HALF, HALF,
                (dx, dy, dz) -> true,
                (w, pos, was, dx, dy, dz) ->
                        taken[(dx + HALF) * side * side + (dy + HALF) * side + (dz + HALF)],
                () -> user.sendMessage(
                        Text.literal("§d⧉ Copied, " + shift + " blocks across."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
