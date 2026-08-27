package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
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

/** Lays a level rail line straight out along your line of sight, cuttings and all. */
public class RailLayerItem extends ArsenalItem {
    private static final int LENGTH = 200;
    private static final int PER_TICK = 4;
    private static final int COOLDOWN = 300;

    public RailLayerItem(Settings settings) {
        super(settings, "Lays a level rail line straight out along your line of sight, cuttings and all.");
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
        // Snapped to whichever axis you are closest to facing. A diagonal line of
        // rails is a staircase of disconnected track, which is not a railway.
        int sx = Math.abs(aim.x) > Math.abs(aim.z) ? (aim.x > 0 ? 1 : -1) : 0;
        int sz = sx == 0 ? (aim.z > 0 ? 1 : -1) : 0;
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int floorY = (int) Math.floor(user.getY()) - 1;
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§7═ Laying track."), true);
        int[] step = {1};
        Scheduler.repeat(() -> {
            for (int n = 0; n < PER_TICK && step[0] <= LENGTH; n++, step[0]++) {
                int px = cx + sx * step[0];
                int pz = cz + sz * step[0];
                // A bed under the rail and headroom over it, so the line runs level
                // through a hill instead of stopping at one.
                put(serverWorld, px, floorY, pz, Blocks.COBBLESTONE.getDefaultState());
                for (int up = 2; up <= 4; up++) {
                    put(serverWorld, px, floorY + up, pz, Blocks.AIR.getDefaultState());
                    put(serverWorld, px - sz, floorY + up, pz - sx, Blocks.AIR.getDefaultState());
                    put(serverWorld, px + sz, floorY + up, pz + sx, Blocks.AIR.getDefaultState());
                }
                // A powered rail every eighth block, with a torch beside it. Without
                // the torch the powered rail is a brake, not a booster.
                boolean boost = step[0] % 8 == 0;
                put(serverWorld, px, floorY + 1, pz,
                        (boost ? Blocks.POWERED_RAIL : Blocks.RAIL).getDefaultState());
                if (boost) {
                    // Something under the torch first. Beside the track is untouched
                    // ground, and over a ravine that is air — the torch would be laid
                    // and pop off in the same tick.
                    put(serverWorld, px + sz, floorY, pz + sx,
                            Blocks.COBBLESTONE.getDefaultState());
                    put(serverWorld, px + sz, floorY + 1, pz + sx,
                            Blocks.TORCH.getDefaultState());
                }
            }
            if (step[0] <= LENGTH) {
                return true;
            }
            user.sendMessage(Text.literal("§7═ " + LENGTH + " blocks of track."), true);
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
