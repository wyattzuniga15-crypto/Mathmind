package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.Set;
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

/** Point at an ore and the whole vein goes, however far it runs. */
public class VeinMinerItem extends ArsenalItem {
    private static final int MAX = 640;
    private static final int PER_TICK = 60;
    private static final int COOLDOWN = 60;

    public VeinMinerItem(Settings settings) {
        super(settings, "Point at an ore and the whole vein goes, however far it runs.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 40.0);
        BlockPos start = BlockPos.ofFloored(at);
        BlockState kind = serverWorld.getBlockState(start);
        if (kind.isAir()) {
            user.sendMessage(Text.literal("§7Point at a block."), true);
            return ActionResult.SUCCESS;
        }
        // Breadth-first over blocks of the same kind, bounded twice: by how many
        // it will take in total and by how many it takes in one tick. A vein of
        // stone would otherwise be the whole world.
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 1.2F, 1.4F);
        ArrayDeque<BlockPos> edge = new ArrayDeque<>();
        Set<BlockPos> seen = new HashSet<>();
        edge.add(start);
        seen.add(start);
        int[] taken = {0};
        Scheduler.repeat(() -> {
            for (int n = 0; n < PER_TICK; n++) {
                BlockPos spot = edge.poll();
                if (spot == null || taken[0] >= MAX) {
                    user.sendMessage(Text.literal("§7⛏ " + taken[0] + " blocks of vein."), true);
                    return false;
                }
                BlockState was = serverWorld.getBlockState(spot);
                if (!was.isOf(kind.getBlock())) {
                    continue;
                }
                Journal.clear(serverWorld, spot, was, Blocks.AIR.getDefaultState());
                taken[0]++;
                for (int dx = -1; dx <= 1; dx++) {
                    for (int dy = -1; dy <= 1; dy++) {
                        for (int dz = -1; dz <= 1; dz++) {
                            BlockPos next = spot.add(dx, dy, dz);
                            if (seen.size() < MAX * 8 && seen.add(next)) {
                                edge.add(next);
                            }
                        }
                    }
                }
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
