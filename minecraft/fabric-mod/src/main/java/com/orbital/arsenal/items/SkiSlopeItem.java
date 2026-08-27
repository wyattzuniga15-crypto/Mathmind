package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
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

/** Lays a long packed-ice ramp running away from you, downhill all the way. */
public class SkiSlopeItem extends ArsenalItem {
    private static final int LENGTH = 160;
    private static final int WIDE = 4;
    private static final int PER_TICK = 3;
    private static final int COOLDOWN = 300;

    public SkiSlopeItem(Settings settings) {
        super(settings, "Lays a long packed-ice ramp running away from you, downhill all the way.");
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
        // From your feet downward. Starting thirty blocks up put the top of the
        // run in mid-air above the player, which is a ramp to nowhere.
        int top = (int) Math.floor(user.getY());
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§b⟋ Downhill from here."), true);
        int[] step = {0};
        Scheduler.repeat(() -> {
            for (int n = 0; n < PER_TICK && step[0] < LENGTH; n++, step[0]++) {
                // One block of fall every four along, which is shallow enough to
                // carry speed and steep enough to keep it.
                int y = top - step[0] / 4;
                int px = cx + sx * step[0];
                int pz = cz + sz * step[0];
                for (int across = -WIDE; across <= WIDE; across++) {
                    int ax = px + (-sz) * across;
                    int az = pz + sx * across;
                    // Walls at the edges, so a fast run does not end in the trees.
                    put(serverWorld, ax, y, az, Math.abs(across) == WIDE
                            ? Blocks.SNOW_BLOCK.getDefaultState()
                            : Blocks.PACKED_ICE.getDefaultState());
                    for (int up = 1; up <= 3; up++) {
                        if (Math.abs(across) == WIDE) {
                            if (up == 1) {
                                put(serverWorld, ax, y + up, az, Blocks.SNOW_BLOCK.getDefaultState());
                                continue;
                            }
                        }
                        cut(serverWorld, ax, y + up, az);
                    }
                }
            }
            if (step[0] < LENGTH) {
                return true;
            }
            user.sendMessage(Text.literal("§b⟋ " + LENGTH + " blocks. Good luck."), true);
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
    
    private static void cut(net.minecraft.server.world.ServerWorld world, int x, int y, int z) {
        BlockPos spot = new BlockPos(x, y, z);
        BlockState was = world.getBlockState(spot);
        if (!was.isAir() && !was.isOf(Blocks.BEDROCK)) {
            Journal.clear(world, spot, was, Blocks.AIR.getDefaultState());
        }
    }
}
