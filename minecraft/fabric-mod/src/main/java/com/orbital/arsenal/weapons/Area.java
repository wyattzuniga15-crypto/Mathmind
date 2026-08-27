package com.orbital.arsenal.weapons;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import java.util.ArrayList;
import java.util.List;

/**
 * Sweeping a region of the world, a few thousand blocks at a time.
 *
 * By the twentieth item it was clear that almost everything which is not a
 * falling sculpture is this: pick a region, decide what each block in it
 * becomes, and get through it without stalling the server. Written out
 * longhand that is forty lines of cursor bookkeeping per item, which is forty
 * lines per item in which to get the budget wrong.
 *
 * Every write goes through the journal, so the rewind clocks undo anything
 * built on this without each item having to remember to ask.
 */
public final class Area {
    private Area() {}

    private static final int PER_TICK = 9_000;

    /** What a block becomes, or null to leave it alone. */
    public interface Paint {
        BlockState at(ServerWorld world, BlockPos pos, BlockState was, int dx, int dy, int dz);
    }

    /** True for the offsets inside the region. */
    public interface Region {
        boolean holds(int dx, int dy, int dz);
    }

    /**
     * Walk a box of offsets around {@code centre}, painting what {@code region}
     * holds. Y is the outer loop, so anything built rises rather than appearing.
     */
    public static void sweep(ServerWorld world, Vec3d centre, int spanX, int spanY, int spanZ,
                             Region region, Paint paint, Runnable then) {
        int cx = (int) Math.floor(centre.x);
        int cy = (int) Math.floor(centre.y);
        int cz = (int) Math.floor(centre.z);
        int floor = world.getBottomY() + 1;
        int ceiling = world.getBottomY() + world.getHeight() - 1;

        int[] y = {-spanY};
        int[] x = {-spanX};
        int[] z = {-spanZ};
        int[] painted = {0};
        BlockPos.Mutable pos = new BlockPos.Mutable();

        Scheduler.repeat(() -> {
            int budget = PER_TICK;
            while (budget-- > 0) {
                if (y[0] > spanY) {
                    if (then != null) {
                        then.run();
                    }
                    return false;
                }
                int wy = cy + y[0];
                if (wy >= floor && wy <= ceiling && region.holds(x[0], y[0], z[0])) {
                    pos.set(cx + x[0], wy, cz + z[0]);
                    BlockState was = world.getBlockState(pos);
                    if (!was.isOf(Blocks.BEDROCK)) {
                        BlockState becomes = paint.at(world, pos, was, x[0], y[0], z[0]);
                        if (becomes != null && becomes != was) {
                            Journal.clear(world, pos.toImmutable(), was, becomes);
                            painted[0]++;
                        }
                    }
                }
                if (++z[0] > spanZ) {
                    z[0] = -spanZ;
                    if (++x[0] > spanX) {
                        x[0] = -spanX;
                        y[0]++;
                    }
                }
            }
            return true;
        });
    }

    /** The common case: a ball of one radius. */
    public static void ball(ServerWorld world, Vec3d centre, int radius, Paint paint, Runnable then) {
        sweep(world, centre, radius, radius, radius,
                (dx, dy, dz) -> dx * dx + dy * dy + dz * dz <= radius * radius, paint, then);
    }

    /** A disc of ground and everything under it, to a depth. */
    public static void column(ServerWorld world, Vec3d centre, int radius, int up, int down,
                              Paint paint, Runnable then) {
        sweep(world, centre, radius, Math.max(up, down), radius,
                (dx, dy, dz) -> dx * dx + dz * dz <= radius * radius && dy <= up && dy >= -down,
                paint, then);
    }

    /**
     * The first solid block below the sky near a height.
     *
     * Used instead of the heightmap accessor, which has been renamed across
     * versions; this has not, and every item that needs ground level needs it
     * the same way.
     */
    public static int surface(ServerWorld world, int x, int z, int near) {
        BlockPos.Mutable probe = new BlockPos.Mutable();
        for (int y = near + 48; y > near - 48; y--) {
            probe.set(x, y, z);
            if (!world.getBlockState(probe).isAir()) {
                return y;
            }
        }
        return near;
    }

    /** Every living thing within reach of a point. */
    public static Iterable<Entity> living(ServerWorld world, Entity except, Vec3d at, double reach) {
        Box box = new Box(at.x - reach, at.y - reach, at.z - reach,
                at.x + reach, at.y + reach, at.z + reach);
        return world.getOtherEntities(except, box);
    }

    /**
     * Every living thing near a point except the players.
     *
     * An area effect that removes what it catches must not be handed another
     * player: discard() on a ServerPlayerEntity takes them out of the world
     * without telling their client, which desyncs the session rather than
     * killing them.
     */
    public static Iterable<Entity> mobs(ServerWorld world, Entity except, Vec3d at, double reach) {
        List<Entity> found = new ArrayList<>();
        for (Entity thing : living(world, except, at, reach)) {
            if (!(thing instanceof PlayerEntity)) {
                found.add(thing);
            }
        }
        return found;
    }

    /** Shove everything near a point away from it. */
    public static int shove(ServerWorld world, Entity except, Vec3d at, double reach, double force) {
        int moved = 0;
        for (Entity thing : living(world, except, at, reach)) {
            double dx = thing.getX() - at.x;
            double dy = thing.getY() - at.y;
            double dz = thing.getZ() - at.z;
            double d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d < 0.001) {
                continue;
            }
            // Falls off with distance, or the edge of the blast hits as hard
            // as the centre and the whole thing reads as a flat push.
            double scale = force * (1.0 - Math.min(1.0, d / reach)) / d;
            thing.addVelocity(dx * scale, Math.abs(dy * scale) + 0.35, dz * scale);
            moved++;
        }
        return moved;
    }

    /** Hurt everything living near a point. */
    public static int harm(ServerWorld world, Entity except, Vec3d at, double reach) {
        int hit = 0;
        for (Entity thing : living(world, except, at, reach)) {
            if (thing instanceof LivingEntity living) {
                living.kill(world);
                hit++;
            }
        }
        return hit;
    }
}
