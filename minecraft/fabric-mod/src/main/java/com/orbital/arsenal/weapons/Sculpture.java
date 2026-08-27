package com.orbital.arsenal.weapons;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.FallingBlockEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

/**
 * Enormous things, dropped from the sky.
 *
 * The giant potato and the bazooka cat were each written out longhand, and
 * they turned out to be the same program twice: assemble a solid out of
 * falling blocks, follow it down, and do something where it lands. Everything
 * that differs between them is a function from a coordinate to a block. So
 * that function is the only thing a sculpture has to supply here.
 *
 * They hold their shape in flight for a reason worth knowing: every falling
 * block in Minecraft accelerates identically, so a cluster released on one
 * tick stays a cluster. There is no rigid-body physics to borrow, and none is
 * needed.
 */
public final class Sculpture {
    private Sculpture() {}

    /** What a sculpture is: which block sits at each offset, or null for air. */
    public interface Shape {
        Block at(int x, int y, int z);
    }

    /** What happens where it lands. */
    public interface Impact {
        void run(ServerWorld world, PlayerEntity user, Vec3d at);
    }

    /** If it somehow never touches down, go off anyway rather than hanging. */
    private static final int MAX_FALL = 600;
    private static final int CARVE_PER_TICK = 12_000;

    /**
     * Build {@code shape} in the sky above the target and let it fall.
     *
     * @param reach how far out from the centre the shape can extend
     * @return how many blocks the sculpture came to
     */
    public static int drop(ServerWorld world, PlayerEntity user, Vec3d target,
                           Shape shape, int reach, int height, String name, Impact impact) {
        List<Entity> parts = new ArrayList<>();
        int cx = (int) Math.floor(target.x);
        int cy = (int) Math.floor(target.y) + height;
        int cz = (int) Math.floor(target.z);
        BlockPos.Mutable pos = new BlockPos.Mutable();

        for (int x = -reach; x <= reach; x++) {
            for (int y = -reach; y <= reach; y++) {
                for (int z = -reach; z <= reach; z++) {
                    Block block = shape.at(x, y, z);
                    if (block == null) {
                        continue;
                    }
                    BlockState state = block.getDefaultState();
                    pos.set(cx + x, cy + y, cz + z);
                    BlockPos spot = pos.toImmutable();
                    // A block has to exist somewhere before it can be made to
                    // fall. The placement lasts one tick, high enough up that
                    // there is nothing to disturb.
                    world.setBlockState(spot, state, 2);
                    FallingBlockEntity part = FallingBlockEntity.spawnFromBlock(world, spot, state);
                    if (part != null) {
                        part.dropItem = false;
                        parts.add(part);
                    }
                }
            }
        }

        user.sendMessage(Text.literal("§6▼ " + name + " — " + parts.size() + " blocks"), true);
        world.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 4.0F, 0.7F);
        watch(world, user, target, parts, impact);
        return parts.size();
    }

    /** Follow it down and fire when any part of it touches something. */
    private static void watch(ServerWorld world, PlayerEntity user, Vec3d target,
                              List<Entity> parts, Impact impact) {
        int[] age = {0};
        Scheduler.repeat(() -> {
            age[0]++;
            Entity lead = null;
            boolean landed = false;
            for (Entity part : parts) {
                if (lead == null && !part.isRemoved()) {
                    lead = part;
                }
                if (part.isOnGround() || part.isRemoved()) {
                    landed = true;
                    break;
                }
            }
            if (!landed && age[0] < MAX_FALL) {
                if (lead != null && age[0] % 4 == 0) {
                    world.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                            lead.getX(), lead.getY(), lead.getZ(), 10, 3.0, 2.0, 3.0, 0.02);
                }
                return true;
            }

            // Where it actually ended up, not where it was aimed. Read the
            // position before discarding, or there is nothing left to ask.
            Vec3d where = lead != null
                    ? new Vec3d(lead.getX(), lead.getY(), lead.getZ())
                    : target;
            // Clear what is left first, or blocks still in the air rain into
            // the finished crater.
            for (Entity part : parts) {
                part.discard();
            }
            impact.run(world, user, where);
            return false;
        });
    }

    /**
     * A bowl-shaped crater: full depth in the middle, rising to ground level
     * at the rim. Carved through the journal, so the clocks can put it back.
     */
    public static void crater(ServerWorld world, Vec3d at, int radius, int depth, Runnable then) {
        int cx = (int) Math.floor(at.x);
        int cy = (int) Math.floor(at.y);
        int cz = (int) Math.floor(at.z);
        int[] dy = {4};
        int[] x = {Integer.MIN_VALUE};
        BlockPos.Mutable pos = new BlockPos.Mutable();
        BlockState air = Blocks.AIR.getDefaultState();

        Scheduler.repeat(() -> {
            int budget = CARVE_PER_TICK;
            while (budget > 0) {
                if (dy[0] < -depth) {
                    if (then != null) {
                        then.run();
                    }
                    return false;
                }
                double r = radiusAt(dy[0], radius, depth);
                if (r <= 0.0) {
                    dy[0]--;
                    x[0] = Integer.MIN_VALUE;
                    continue;
                }
                int span = (int) r;
                if (x[0] == Integer.MIN_VALUE) {
                    x[0] = -span;
                }
                int half = (int) Math.sqrt(Math.max(0.0, r * r - (double) x[0] * x[0]));
                for (int z = -half; z <= half; z++) {
                    pos.set(cx + x[0], cy + dy[0], cz + z);
                    BlockState state = world.getBlockState(pos);
                    if (!state.isAir() && !state.isOf(Blocks.BEDROCK)) {
                        Journal.clear(world, pos.toImmutable(), state, air);
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

    private static double radiusAt(int dy, int radius, int depth) {
        if (dy >= 0) {
            return dy <= 4 ? radius : 0.0;
        }
        int below = -dy;
        return below > depth ? 0.0 : radius * Math.sqrt(1.0 - below / (double) depth);
    }

    /** The usual noise and smoke of something enormous hitting the ground. */
    public static void boom(ServerWorld world, Vec3d at, float power, int smoke) {
        Strikes.blast(world, at.add(0, 2, 0), power);
        world.playSound(null, BlockPos.ofFloored(at), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 100.0F, 0.5F);
        world.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                at.x, at.y + 3, at.z, smoke, 12.0, 5.0, 12.0, 0.1);
    }

    // ---- shape helpers, so a sculpture reads as a description -------------

    public static boolean ball(double x, double y, double z, double cx, double cy, double cz, double r) {
        double dx = x - cx, dy = y - cy, dz = z - cz;
        return dx * dx + dy * dy + dz * dz <= r * r;
    }

    public static boolean blob(double x, double y, double z,
                               double cx, double cy, double cz,
                               double rx, double ry, double rz) {
        double dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
        return dx * dx + dy * dy + dz * dz <= 1.0;
    }

    public static boolean slab(double x, double y, double z,
                               double x0, double x1, double y0, double y1, double z0, double z1) {
        return x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1;
    }

    /** A vertical cylinder, for legs, chimneys and cake tiers. */
    public static boolean post(double x, double z, double cx, double cz, double r) {
        double dx = x - cx, dz = z - cz;
        return dx * dx + dz * dz <= r * r;
    }
}
