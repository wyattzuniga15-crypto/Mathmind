package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
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

/** Raises a lit tower with a spiral stair inside, sixty blocks up. */
public class TowerBuilderItem extends ArsenalItem {
    private static final int HEIGHT = 60;
    private static final int R = 6;
    private static final int COOLDOWN = 300;

    public TowerBuilderItem(Settings settings) {
        super(settings, "Raises a lit tower with a spiral stair inside, sixty blocks up.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int base = Area.surface(serverWorld, cx, cz, (int) user.getY()) + 1;
        int[] up = {0};
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§7🗼 Building…"), true);
        Scheduler.repeat(() -> {
            for (int n = 0; n < 2 && up[0] < HEIGHT; n++, up[0]++) {
                int y = base + up[0];
                for (int x = -R; x <= R; x++) {
                    for (int z = -R; z <= R; z++) {
                        double d = Math.sqrt((double) x * x + (double) z * z);
                        BlockPos at = new BlockPos(cx + x, y, cz + z);
                        BlockState was = serverWorld.getBlockState(at);
                        if (d <= R && d > R - 1.5) {
                            Journal.clear(serverWorld, at, was, Blocks.STONE_BRICKS.getDefaultState());
                        } else if (d <= R - 1.5) {
                            // The stair is one step per course, wrapping the wall:
                            // a ladder would do, but a stair you can run up is the
                            // difference between a tower and a well.
                            double a = Math.atan2(z, x);
                            double want = (up[0] * 0.55) % (Math.PI * 2) - Math.PI;
                            boolean onStep = Math.abs(Math.atan2(Math.sin(a - want),
                                    Math.cos(a - want))) < 0.55 && d > 1.5;
                            BlockState becomes = onStep
                                    ? Blocks.STONE_BRICKS.getDefaultState()
                                    : Blocks.AIR.getDefaultState();
                            if (was != becomes) {
                                Journal.clear(serverWorld, at, was, becomes);
                            }
                        }
                    }
                }
                if (up[0] % 10 == 0) {
                    BlockPos lamp = new BlockPos(cx, y, cz);
                    Journal.clear(serverWorld, lamp, serverWorld.getBlockState(lamp),
                            Blocks.GLOWSTONE.getDefaultState());
                }
            }
            if (up[0] < HEIGHT) {
                return true;
            }
            user.sendMessage(Text.literal("§7🗼 " + HEIGHT + " blocks. Mind the stairs."), true);
            return false;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
