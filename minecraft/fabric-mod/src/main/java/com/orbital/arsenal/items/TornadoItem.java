package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.FallingBlockEntity;
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
 * A vortex that wanders off on its own and tears up whatever it crosses.
 *
 * It is not aimed at anything. It drifts, turning by a small random amount
 * each tick, which is what makes the scar it leaves a winding one rather than
 * a straight trench — a tornado that travelled in a line would just be a
 * slower railgun.
 */
public class TornadoItem extends Item {
    private static final int LIFETIME = 600;
    private static final double DRIFT = 0.35;
    private static final double RADIUS = 7.0;
    private static final int HEIGHT = 26;
    /** Blocks torn up per tick. Enough to be violent, not enough to stall. */
    private static final int PER_TICK = 90;
    private static final int COOLDOWN = 300;

    /** The first solid block below the sky, near the given height. */
    private static int surface(ServerWorld world, int x, int z, int near) {
        BlockPos.Mutable probe = new BlockPos.Mutable();
        for (int y = near + 40; y > near - 40; y--) {
            probe.set(x, y, z);
            if (!world.getBlockState(probe).isAir()) {
                return y;
            }
        }
        return near;
    }

    public TornadoItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        double[] x = {user.getX()};
        double[] z = {user.getZ()};
        double[] heading = {ThreadLocalRandom.current().nextDouble() * Math.PI * 2};
        int[] age = {0};
        BlockPos.Mutable pos = new BlockPos.Mutable();
        BlockState air = Blocks.AIR.getDefaultState();

        user.sendMessage(Text.literal("§7🌪 It has a mind of its own."), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 4.0F, 0.4F);

        // The funnel's base is fixed where it started; taking it from the
        // player each tick made the whole tornado rise and fall with them.
        double baseY = user.getY();
        Scheduler.repeat(() -> {
            if (++age[0] > LIFETIME) {
                return false;
            }
            // Wander: a small random turn each tick, never a new direction.
            heading[0] += (ThreadLocalRandom.current().nextDouble() - 0.5) * 0.25;
            x[0] += Math.cos(heading[0]) * DRIFT;
            z[0] += Math.sin(heading[0]) * DRIFT;

            int cx = (int) Math.floor(x[0]);
            int cz = (int) Math.floor(z[0]);
            // Walk down for the surface rather than asking the heightmap:
            // that accessor has been renamed across versions and this has not.
            int ground = surface(serverWorld, cx, cz, (int) baseY);

            // Tear blocks loose and fling them, rather than deleting them:
            // the debris in the air is what reads as a tornado.
            int taken = 0;
            for (int attempt = 0; attempt < 200 && taken < PER_TICK; attempt++) {
                ThreadLocalRandom dice = ThreadLocalRandom.current();
                double angle = dice.nextDouble() * Math.PI * 2;
                double r = dice.nextDouble() * RADIUS;
                int bx = cx + (int) (Math.cos(angle) * r);
                int bz = cz + (int) (Math.sin(angle) * r);
                int by = ground - dice.nextInt(4);
                pos.set(bx, by, bz);
                BlockState state = serverWorld.getBlockState(pos);
                if (state.isAir() || state.isOf(Blocks.BEDROCK)) {
                    continue;
                }
                BlockPos at = pos.toImmutable();
                Journal.clear(serverWorld, at, state, air);
                FallingBlockEntity debris = FallingBlockEntity.spawnFromBlock(
                        serverWorld, at.up(HEIGHT / 2), state);
                if (debris != null) {
                    debris.dropItem = false;
                    double spin = angle + Math.PI / 2;
                    debris.setVelocity(new Vec3d(Math.cos(spin) * 0.6, 0.9, Math.sin(spin) * 0.6));
                }
                taken++;
            }

            // Anything caught goes up and around with the blocks.
            Box reach = new Box(x[0] - RADIUS, ground - 4, z[0] - RADIUS,
                    x[0] + RADIUS, ground + HEIGHT, z[0] + RADIUS);
            for (Entity caught : serverWorld.getOtherEntities(null, reach)) {
                double dx = caught.getX() - x[0];
                double dz = caught.getZ() - z[0];
                double spin = Math.atan2(dz, dx) + Math.PI / 2;
                caught.addVelocity(Math.cos(spin) * 0.5, 0.45, Math.sin(spin) * 0.5);
            }

            for (int i = 0; i < HEIGHT; i += 2) {
                double swirl = age[0] * 0.4 + i * 0.5;
                double r = 1.0 + RADIUS * (i / (double) HEIGHT);
                serverWorld.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                        x[0] + Math.cos(swirl) * r, ground + i, z[0] + Math.sin(swirl) * r,
                        3, 0.6, 0.4, 0.6, 0.02);
            }
            return true;
        });

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
