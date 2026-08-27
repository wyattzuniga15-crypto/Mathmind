package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** A spiral water chute from where you stand down to the ground. */
public class WaterslideItem extends Item {
    private static final int RADIUS = 9;
    private static final int PER_BLOCK = 6;
    private static final int TURN = 12;
    private static final int PER_TICK = 14;
    private static final int COOLDOWN = 300;

    public WaterslideItem(Settings settings) {
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
        int ground = Area.surface(serverWorld, cx + RADIUS, cz, top);
        if (top - ground < 6) {
            user.sendMessage(Text.literal("§7Go up first — there is nothing to slide down."), true);
            return ActionResult.SUCCESS;
        }
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§9≈ Down you go."), true);
        // Six samples per block of drop, one full turn every twelve blocks.
        // At radius nine that puts consecutive centres about three quarters of
        // a block apart, so the trough is continuous. Dropping a whole block
        // per angular step left them nearly five apart — a string of baths.
        int samples = (top - ground) * PER_BLOCK;
        int[] s = {0};
        Scheduler.repeat(() -> {
            for (int n = 0; n < PER_TICK; n++) {
                if (s[0] >= samples) {
                    user.sendMessage(
                            Text.literal("§9≈ It ends where the ground does."), true);
                    return false;
                }
                double a = s[0] * (Math.PI * 2.0) / (TURN * PER_BLOCK);
                int y = top - s[0] / PER_BLOCK;
                int sx = cx + (int) Math.round(Math.cos(a) * RADIUS);
                int sz = cz + (int) Math.round(Math.sin(a) * RADIUS);
                for (int dx = -1; dx <= 1; dx++) {
                    for (int dz = -1; dz <= 1; dz++) {
                        // A trough: solid walls and floor, water in the middle,
                        // air above. Water in an open channel runs out the side.
                        boolean wall = Math.abs(dx) == 1 || Math.abs(dz) == 1;
                        put(serverWorld, sx + dx, y, sz + dz,
                                Blocks.PRISMARINE.getDefaultState());
                        if (wall) {
                            put(serverWorld, sx + dx, y + 1, sz + dz,
                                    Blocks.PRISMARINE.getDefaultState());
                            put(serverWorld, sx + dx, y + 2, sz + dz,
                                    Blocks.PRISMARINE.getDefaultState());
                        } else {
                            put(serverWorld, sx + dx, y + 1, sz + dz,
                                    Blocks.WATER.getDefaultState());
                            put(serverWorld, sx + dx, y + 2, sz + dz,
                                    Blocks.AIR.getDefaultState());
                        }
                    }
                }
                s[0]++;
            }
            return true;
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
