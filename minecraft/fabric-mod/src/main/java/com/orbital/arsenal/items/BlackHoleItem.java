package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
import java.util.Random;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.FallingBlockEntity;
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
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * A singularity that eats a sphere of the world.
 *
 * On size: this clears about 22.4 million blocks, roughly eighteen times the
 * nuke. It is not larger because it cannot be — Minecraft only keeps chunks
 * loaded a couple of hundred blocks around a player, and blocks in unloaded
 * chunks do not exist to be removed. A 175-block radius sits just inside that,
 * about eleven chunks out; going further would only delete air.
 *
 * The consumption walks outward from the centre rather than top-down, so the
 * hole visibly eats the world from the inside out, and it is budgeted per tick
 * because 22 million block changes in one go would stop the server dead.
 */
public class BlackHoleItem extends Item {
    private static final int RADIUS = 175;
    private static final int AIM_DISTANCE = 80; // keeps the sphere in loaded chunks
    private static final int BLOCKS_PER_TICK = 40000;
    private static final double PULL_RADIUS = 220.0;
    private static final double PULL_STRENGTH = 2.4;
    private static final int DEBRIS_PER_TICK = 18;
    private static final int COOLDOWN = 1200;

    private final Random random = new Random();

    public BlackHoleItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Vec3d centre = Strikes.aim(user, AIM_DISTANCE);
        user.sendMessage(Text.literal("§5● SINGULARITY FORMING"), true);
        serverWorld.playSound(null, BlockPos.ofFloored(centre), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 100.0F, 0.3F);

        consume(serverWorld, centre);
        pull(serverWorld, centre, 0);

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /**
     * Clear the sphere, a budget of blocks at a time.
     *
     * Layers are walked from the middle outward — 0, -1, +1, -2, +2 — so the
     * void opens at the centre and spreads, rather than raining down from the
     * top like the nuke's crater does.
     */
    private void consume(ServerWorld world, Vec3d centre) {
        int cx = (int) Math.floor(centre.x);
        int cy = (int) Math.floor(centre.y);
        int cz = (int) Math.floor(centre.z);

        int[] layer = {0};              // index into the centre-outward order
        int[] x = {Integer.MIN_VALUE};  // cursor across the current layer
        BlockPos.Mutable pos = new BlockPos.Mutable();
        BlockState air = Blocks.AIR.getDefaultState();

        Scheduler.repeat(() -> {
            int budget = BLOCKS_PER_TICK;
            while (budget > 0) {
                if (layer[0] > RADIUS * 2 + 1) {
                    collapse(world, centre);
                    return false;
                }
                int dy = layerOffset(layer[0]);
                double discSquared = (double) RADIUS * RADIUS - (double) dy * dy;
                if (discSquared <= 0) {
                    layer[0]++;
                    x[0] = Integer.MIN_VALUE;
                    continue;
                }
                int disc = (int) Math.sqrt(discSquared);
                if (x[0] == Integer.MIN_VALUE) {
                    x[0] = -disc;
                }
                int half = (int) Math.sqrt(Math.max(0.0, discSquared - (double) x[0] * x[0]));
                for (int z = -half; z <= half; z++) {
                    pos.set(cx + x[0], cy + dy, cz + z);
                    BlockState state = world.getBlockState(pos);
                    // Leave bedrock: punching through the world floor leaves a
                    // hole into the void that can never be repaired.
                    if (!state.isAir() && !state.isOf(Blocks.BEDROCK)) {
                        // Through the journal so the rewind clock can put this
                        // back — though a sphere this size overruns its record,
                        // so an undo here is partial. It writes with flag 2,
                        // skipping neighbour updates: at this scale the cascade
                        // would cost more than the removal itself.
                        Journal.clear(world, pos, state, air);
                    }
                }
                budget -= (2 * half + 1);
                if (++x[0] > disc) {
                    layer[0]++;
                    x[0] = Integer.MIN_VALUE;
                }
            }

            double reach = Math.min(RADIUS, layerOffsetReach(layer[0]));
            debris(world, centre, reach);
            Strikes.puff(world, ParticleTypes.LARGE_SMOKE, centre, 40, 3.0, 0.05);
            return true;
        });
    }

    /** 0, -1, +1, -2, +2 … so the sphere opens from its middle. */
    private static int layerOffset(int index) {
        return (index % 2 == 0) ? -(index / 2) : (index + 1) / 2;
    }

    private static double layerOffsetReach(int index) {
        return index / 2.0;
    }

    /** Tear loose blocks near the edge and let them fall inward. */
    private void debris(ServerWorld world, Vec3d centre, double reach) {
        if (reach < 4.0) {
            return;
        }
        for (int i = 0; i < DEBRIS_PER_TICK; i++) {
            double theta = random.nextDouble() * Math.PI * 2.0;
            double phi = Math.acos(2.0 * random.nextDouble() - 1.0);
            double r = reach * (0.75 + 0.25 * random.nextDouble());
            BlockPos at = BlockPos.ofFloored(centre.add(
                    Math.sin(phi) * Math.cos(theta) * r,
                    Math.cos(phi) * r,
                    Math.sin(phi) * Math.sin(theta) * r));

            BlockState state = world.getBlockState(at);
            if (state.isAir() || state.isOf(Blocks.BEDROCK)) {
                continue;
            }
            FallingBlockEntity block = FallingBlockEntity.spawnFromBlock(world, at, state);
            block.dropItem = false;
            Vec3d inward = centre.subtract(Vec3d.ofCenter(at)).normalize();
            block.setVelocity(inward.multiply(0.55));
        }
    }

    /** Drag everything nearby toward the centre, harder the closer it gets. */
    private void pull(ServerWorld world, Vec3d centre, int tick) {
        if (tick > 700) {
            return;
        }
        Box field = new Box(
                centre.x - PULL_RADIUS, centre.y - PULL_RADIUS, centre.z - PULL_RADIUS,
                centre.x + PULL_RADIUS, centre.y + PULL_RADIUS, centre.z + PULL_RADIUS);
        for (Entity entity : world.getOtherEntities(null, field)) {
            Vec3d toCentre = centre.subtract(entity.getX(), entity.getY(), entity.getZ());
            double distance = toCentre.length();
            if (distance < 1.5) {
                continue;
            }
            // Inverse falloff, floored so nothing gets flung at the very centre.
            double strength = PULL_STRENGTH / Math.max(6.0, distance);
            Vec3d nudge = toCentre.normalize().multiply(strength);
            // addVelocity rather than setVelocity: it flags the change as needing
            // to be sent to the client, which setVelocity alone does not — without
            // that a player being dragged in feels nothing on their own screen.
            entity.addVelocity(nudge.x, nudge.y, nudge.z);
        }
        Scheduler.after(1, () -> pull(world, centre, tick + 1));
    }

    private void collapse(ServerWorld world, Vec3d centre) {
        Strikes.blast(world, centre, 12.0F);
        Strikes.puff(world, ParticleTypes.EXPLOSION, centre, 120, 12.0, 0.4);
        world.playSound(null, BlockPos.ofFloored(centre), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 100.0F, 0.4F);
    }
}
