package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
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

/**
 * Lifts a disc of ground into the sky, trees and buildings intact.
 *
 * The lift is a copy upward followed by an erase below, done column by column
 * so the two halves of a column never disagree. Doing it the other way — erase
 * first, then place — loses the column, and doing whole layers at once means a
 * half-finished island is briefly duplicated in mid-air.
 *
 * The underside is tapered to a keel, because a flat-bottomed slab reads as a
 * mistake and a pointed one reads as an island.
 */
public class SkyIslandItem extends ArsenalItem {
    private static final int RADIUS = 22;
    private static final int DEPTH = 14;
    private static final int LIFT = 45;
    private static final int PER_TICK = 3;
    private static final int COOLDOWN = 400;

    public SkyIslandItem(Settings settings) {
        super(settings, "Lifts a disc of ground into the sky, trees and buildings intact.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Vec3d target = Strikes.aim(user, 120.0);
        int cx = (int) Math.floor(target.x);
        int cy = (int) Math.floor(target.y);
        int cz = (int) Math.floor(target.z);

        user.sendMessage(Text.literal("§b☁ Up it goes."), true);
        serverWorld.playSound(null, BlockPos.ofFloored(target), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 6.0F, 0.8F);

        int[] x = {-RADIUS};
        BlockPos.Mutable from = new BlockPos.Mutable();
        BlockPos.Mutable to = new BlockPos.Mutable();
        BlockState air = Blocks.AIR.getDefaultState();

        Scheduler.repeat(() -> {
            for (int n = 0; n < PER_TICK && x[0] <= RADIUS; n++, x[0]++) {
                int half = (int) Math.sqrt(Math.max(0.0,
                        (double) RADIUS * RADIUS - (double) x[0] * x[0]));
                for (int z = -half; z <= half; z++) {
                    double d = Math.sqrt((double) x[0] * x[0] + (double) z * z);
                    // Tapered keel: deep in the middle, shallow at the rim.
                    int deep = (int) (DEPTH * Math.sqrt(Math.max(0.0,
                            1.0 - (d / RADIUS) * (d / RADIUS))));
                    for (int y = 8; y > -deep; y--) {
                        from.set(cx + x[0], cy + y, cz + z);
                        BlockState state = serverWorld.getBlockState(from);
                        if (state.isAir() || state.isOf(Blocks.BEDROCK)) {
                            continue;
                        }
                        // Place above before erasing below, one column at a
                        // time, so a column is never lost or briefly doubled.
                        to.set(cx + x[0], cy + y + LIFT, cz + z);
                        Journal.clear(serverWorld, to.toImmutable(),
                                serverWorld.getBlockState(to), state);
                        Journal.clear(serverWorld, from.toImmutable(), state, air);
                    }
                }
            }
            if (x[0] <= RADIUS) {
                return true;
            }
            serverWorld.spawnParticles(ParticleTypes.CLOUD, true, true,
                    target.x, cy + LIFT - 4, target.z, 400, RADIUS * 0.7, 3.0, RADIUS * 0.7, 0.05);
            user.sendMessage(Text.literal("§b☁ One island, " + (RADIUS * 2)
                    + " across, " + LIFT + " up."), true);
            return false;
        });

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
