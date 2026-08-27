package com.orbital.arsenal.time;

import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;

/**
 * Lifts anything a rewind has just buried.
 *
 * Putting the world back puts blocks back, and whatever was standing in the
 * hole is suddenly inside them. Minecraft's answer to being inside a block is
 * to suffocate you — so undoing a crater killed the very mobs the rewind had
 * only just resurrected, which is the opposite of what the clocks are for.
 *
 * So once a restore finishes, everything in the area it touched is checked and
 * anything now inside solid rock is lifted to the first clear space above it.
 * Only after the restore: doing it while blocks are still going back would
 * check ground that is about to change.
 */
final class Unbury {
    /** How far up to look for air before giving up on a given entity. */
    private static final int MAX_LIFT = 24;

    private Unbury() {}

    static void sweep(ServerWorld world, Box area) {
        BlockPos.Mutable probe = new BlockPos.Mutable();
        for (Entity entity : world.getOtherEntities(null, area)) {
            int x = (int) Math.floor(entity.getX());
            int y = (int) Math.floor(entity.getY());
            int z = (int) Math.floor(entity.getZ());
            if (!buried(world, probe, x, y, z)) {
                continue;
            }
            for (int lift = 1; lift <= MAX_LIFT; lift++) {
                if (!buried(world, probe, x, y + lift, z)) {
                    move(entity, x + 0.5, y + lift, z + 0.5);
                    break;
                }
            }
        }
    }

    /** Is this spot solid at foot or head height? */
    private static boolean buried(ServerWorld world, BlockPos.Mutable probe, int x, int y, int z) {
        return solid(world, probe, x, y, z) || solid(world, probe, x, y + 1, z);
    }

    private static boolean solid(ServerWorld world, BlockPos.Mutable probe, int x, int y, int z) {
        probe.set(x, y, z);
        BlockState state = world.getBlockState(probe);
        // Fluids are not suffocation, and hauling a fish out of restored water
        // would be its own small disaster.
        return !state.isAir() && !state.isOf(Blocks.WATER) && !state.isOf(Blocks.LAVA);
    }

    private static void move(Entity entity, double x, double y, double z) {
        if (entity instanceof ServerPlayerEntity player) {
            // Players need to be told, or the client keeps its own view of
            // where it is and walks straight back into the rock.
            player.networkHandler.requestTeleport(x, y, z, player.getYaw(), player.getPitch());
        } else {
            entity.setPosition(x, y, z);
        }
    }
}
