package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
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

/**
 * Digs a lake and fills it, with a sand beach around the rim.
 *
 * Carved and filled in one downward pass per column rather than two passes
 * over the whole area: a dig-everything-then-fill-everything order leaves a
 * dry pit sitting there for several seconds, which looks like the item failed.
 *
 * The water is placed as still source blocks, not poured from the middle.
 * Flowing water would spend a minute finding its level and drag the server
 * with it.
 */
public class LakeMakerItem extends Item {
    private static final int RADIUS = 28;
    private static final int DEPTH = 10;
    private static final int PER_TICK = 4;
    private static final int COOLDOWN = 200;

    public LakeMakerItem(Settings settings) {
        super(settings);
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

        user.sendMessage(Text.literal("§9≈ Digging a lake…"), true);
        serverWorld.playSound(null, BlockPos.ofFloored(target), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 3.0F, 0.5F);

        int[] x = {-RADIUS};
        BlockPos.Mutable pos = new BlockPos.Mutable();
        BlockState water = Blocks.WATER.getDefaultState();
        BlockState sand = Blocks.SAND.getDefaultState();
        BlockState air = Blocks.AIR.getDefaultState();

        Scheduler.repeat(() -> {
            for (int n = 0; n < PER_TICK && x[0] <= RADIUS; n++, x[0]++) {
                int half = (int) Math.sqrt(Math.max(0.0,
                        (double) RADIUS * RADIUS - (double) x[0] * x[0]));
                for (int z = -half; z <= half; z++) {
                    double d = Math.sqrt((double) x[0] * x[0] + (double) z * z);
                    // A dished bed: deepest in the middle, shallow at the edge.
                    int deep = (int) (DEPTH * Math.sqrt(Math.max(0.0,
                            1.0 - (d / RADIUS) * (d / RADIUS))));
                    boolean beach = d > RADIUS - 3.0;
                    for (int y = cy + 12; y > cy - deep - 1; y--) {
                        pos.set(cx + x[0], y, cz + z);
                        BlockPos here = pos.toImmutable();
                        BlockState was = serverWorld.getBlockState(here);
                        if (was.isOf(Blocks.BEDROCK)) {
                            continue;
                        }
                        // Everything above the waterline is cleared; below it
                        // becomes water, and the rim becomes sand.
                        BlockState becomes = y > cy ? air : (beach ? sand : water);
                        if (y == cy - deep) {
                            becomes = sand;
                        }
                        if (was != becomes) {
                            Journal.clear(serverWorld, here, was, becomes);
                        }
                    }
                }
            }
            if (x[0] <= RADIUS) {
                return true;
            }
            serverWorld.spawnParticles(ParticleTypes.CLOUD, true, true,
                    target.x, cy + 2, target.z, 200, RADIUS * 0.6, 1.0, RADIUS * 0.6, 0.03);
            user.sendMessage(Text.literal("§9≈ " + (RADIUS * 2) + " blocks across. Go swim."), true);
            return false;
        });

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
