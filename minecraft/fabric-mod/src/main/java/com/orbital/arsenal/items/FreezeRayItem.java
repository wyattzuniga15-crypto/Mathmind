package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
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
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * Freezes everything in a wide sphere, then shatters it on the next shot.
 *
 * The two halves are one item on purpose. A freeze you cannot undo is a
 * decoration; a shatter with nothing frozen is a dud. Holding the frozen
 * region between the shots is what makes it a weapon — and the region is
 * remembered as one centre and radius rather than a list of blocks, so it
 * costs nothing to hold.
 */
public class FreezeRayItem extends Item {
    private static final int RADIUS = 24;
    private static final int PER_TICK = 9_000;
    private static final int COOLDOWN = 60;

    /** Where the last freeze landed, or null if nothing is frozen. */
    private static Vec3d frozenAt = null;

    public FreezeRayItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        if (frozenAt != null) {
            shatter(serverWorld, user, frozenAt);
            frozenAt = null;
        } else {
            freeze(serverWorld, user, Strikes.aim(user, 120.0));
        }
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private void freeze(ServerWorld world, PlayerEntity user, Vec3d at) {
        frozenAt = at;
        user.sendMessage(Text.literal("§b❄ FROZEN — fire again to shatter it"), true);
        world.playSound(null, BlockPos.ofFloored(at), SoundEvents.BLOCK_GLASS_BREAK,
                SoundCategory.MASTER, 8.0F, 0.4F);
        sweep(world, at, true, () -> {});

        // Mobs caught in it stop where they stand.
        Box area = new Box(at.x - RADIUS, at.y - RADIUS, at.z - RADIUS,
                at.x + RADIUS, at.y + RADIUS, at.z + RADIUS);
        for (Entity caught : world.getOtherEntities(user, area)) {
            caught.setVelocity(Vec3d.ZERO);
        }
    }

    private void shatter(ServerWorld world, PlayerEntity user, Vec3d at) {
        user.sendMessage(Text.literal("§f✸ SHATTER"), true);
        world.playSound(null, BlockPos.ofFloored(at), SoundEvents.BLOCK_GLASS_BREAK,
                SoundCategory.MASTER, 100.0F, 1.6F);
        world.spawnParticles(ParticleTypes.SNOWFLAKE, true, true,
                at.x, at.y + 4, at.z, 600, RADIUS * 0.6, RADIUS * 0.4, RADIUS * 0.6, 0.2);
        sweep(world, at, false, () -> user.sendMessage(
                Text.literal("§f✸ Gone."), true));
    }

    /**
     * Walk the sphere once, turning it to ice or to nothing.
     *
     * Only blocks the freeze itself created are shattered, which is why the
     * shatter pass checks for ice rather than clearing everything in range —
     * otherwise firing twice would delete the hill the ice was sitting on.
     */
    private void sweep(ServerWorld world, Vec3d at, boolean freezing, Runnable then) {
        int cx = (int) Math.floor(at.x);
        int cy = (int) Math.floor(at.y);
        int cz = (int) Math.floor(at.z);
        int[] x = {-RADIUS};
        BlockPos.Mutable pos = new BlockPos.Mutable();
        BlockState ice = Blocks.PACKED_ICE.getDefaultState();
        BlockState air = Blocks.AIR.getDefaultState();

        Scheduler.repeat(() -> {
            int budget = PER_TICK;
            while (budget > 0) {
                if (x[0] > RADIUS) {
                    then.run();
                    return false;
                }
                for (int y = -RADIUS; y <= RADIUS; y++) {
                    for (int z = -RADIUS; z <= RADIUS; z++) {
                        if (x[0] * x[0] + y * y + z * z > RADIUS * RADIUS) {
                            continue;
                        }
                        pos.set(cx + x[0], cy + y, cz + z);
                        BlockState state = world.getBlockState(pos);
                        if (freezing) {
                            if (!state.isAir() && !state.isOf(Blocks.BEDROCK)
                                    && !state.isOf(Blocks.PACKED_ICE)) {
                                Journal.clear(world, pos.toImmutable(), state, ice);
                            }
                        } else if (state.isOf(Blocks.PACKED_ICE)) {
                            Journal.clear(world, pos.toImmutable(), state, air);
                        }
                    }
                }
                budget -= (2 * RADIUS + 1) * (2 * RADIUS + 1);
                x[0]++;
            }
            return true;
        });
    }
}
