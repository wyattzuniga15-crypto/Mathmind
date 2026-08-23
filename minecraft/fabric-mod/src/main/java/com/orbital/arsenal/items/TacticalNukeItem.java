package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
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
 * A five-second fuse, then a bowl 200 blocks across carved out of the ground.
 *
 * The crater is cleared block by block rather than blown up. Explosions cost
 * far more per block removed, and a bowl this size is over a million blocks —
 * the Bedrock version of this weapon had to settle for 120 blocks across
 * precisely because it only had explosions to work with.
 */
public class TacticalNukeItem extends Item {
    private static final int RADIUS = 100;
    private static final int DEPTH = 30;
    private static final int ABOVE = 25;
    private static final int BLOCKS_PER_TICK = 12000;
    private static final int FUSE_SECONDS = 5;
    private static final int COOLDOWN = 400;

    public TacticalNukeItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Vec3d target = Strikes.aim(user, 300.0);
        countdown(serverWorld, user, target, FUSE_SECONDS);

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private void countdown(ServerWorld world, PlayerEntity user, Vec3d target, int left) {
        if (left <= 0) {
            detonate(world, user, target);
            return;
        }
        user.sendMessage(Text.literal("\u00a7e\u2622 NUKE ARMED \u2014 detonation in " + left), true);
        world.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 1.0F, 2.0F);
        Scheduler.after(20, () -> countdown(world, user, target, left - 1));
    }

    private void detonate(ServerWorld world, PlayerEntity user, Vec3d target) {
        user.sendMessage(Text.literal("\u00a74\u2622 DETONATION"), true);
        Strikes.blast(world, target.add(0, 3, 0), 12.0F);
        world.playSound(null, BlockPos.ofFloored(target), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 100.0F, 0.5F);

        carve(world, target);
        shockwave(world, target, 4.0);
        cloud(world, target, 0);
    }

    /** Walk the bowl a slice at a time, capped so no tick carries too much. */
    private void carve(ServerWorld world, Vec3d target) {
        int cx = (int) Math.floor(target.x);
        int cy = (int) Math.floor(target.y);
        int cz = (int) Math.floor(target.z);

        int[] dy = {ABOVE};
        int[] x = {Integer.MIN_VALUE};
        BlockPos.Mutable pos = new BlockPos.Mutable();

        Scheduler.repeat(() -> {
            int budget = BLOCKS_PER_TICK;
            while (budget > 0) {
                if (dy[0] < -DEPTH) {
                    return false;
                }
                double r = radiusAt(dy[0]);
                if (r <= 0.0) {
                    dy[0]--;
                    x[0] = Integer.MIN_VALUE;
                    continue;
                }
                int span = (int) r;
                if (x[0] == Integer.MIN_VALUE) {
                    x[0] = -span;
                }
                int half = (int) Math.sqrt(Math.max(0.0, r * r - x[0] * x[0]));
                for (int z = -half; z <= half; z++) {
                    pos.set(cx + x[0], cy + dy[0], cz + z);
                    BlockState state = world.getBlockState(pos);
                    if (!state.isAir()) {
                        // Through the journal so the rewind clock can put this
                        // back. It uses flag 2 for the write: that updates
                        // clients without kicking off a cascade of neighbour
                        // updates, which at this scale matters.
                        Journal.clear(world, pos, state, Blocks.AIR.getDefaultState());
                    }
                }
                budget -= (2 * half + 1);
                if (++x[0] > span) {
                    dy[0]--;
                    x[0] = Integer.MIN_VALUE;
                }
            }
            return true;
        });
    }

    /** Bowl profile: full depth at the centre, rising to ground at the rim. */
    private static double radiusAt(int dy) {
        if (dy >= 0) {
            return dy <= ABOVE ? RADIUS : 0.0;
        }
        int below = -dy;
        return below > DEPTH ? 0.0 : RADIUS * Math.sqrt(1.0 - below / (double) DEPTH);
    }

    private void shockwave(ServerWorld world, Vec3d target, double r) {
        if (r > RADIUS) {
            return;
        }
        int count = Math.max(8, (int) (r / 4));
        for (int i = 0; i < count; i++) {
            double angle = (i / (double) count) * Math.PI * 2.0 + r;
            Strikes.puff(world, ParticleTypes.EXPLOSION,
                    target.add(Math.cos(angle) * r, 2.0, Math.sin(angle) * r), 2, 1.0, 0.0);
        }
        Scheduler.after(1, () -> shockwave(world, target, r + 8.0));
    }

    private void cloud(ServerWorld world, Vec3d target, int age) {
        if (age > 45) {
            return;
        }
        double height = age * 2.2;
        double spread = height < 60 ? 2.0 + height * 0.06 : 6.0 + (height - 60) * 0.5;
        Strikes.puff(world, ParticleTypes.LARGE_SMOKE,
                target.add(0, height, 0), 18, spread, 0.02);
        Scheduler.after(1, () -> cloud(world, target, age + 1));
    }
}
