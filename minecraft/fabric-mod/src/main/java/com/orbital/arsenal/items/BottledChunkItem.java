package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
import java.util.HashMap;
import java.util.Map;
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
 * Copy and paste the world.
 *
 * Right-click to draw a 16×16×16 region into the bottle — every block, exactly
 * as it stands. Crouch and right-click somewhere else to put it back down.
 * Steal a village house, carry it a thousand blocks, and set it up in your base
 * with the torches still lit.
 *
 * Taking a copy leaves the original alone. That is the useful default by a
 * wide margin: a bottle that ate what it copied would make every mistake
 * permanent, and the Rewind Clock is thirty seconds of protection, not a
 * general safety net.
 *
 * The bottle remembers one region per player rather than storing it in the item
 * itself. Putting four thousand block states inside an item stack means custom
 * item components, and those have been reworked more than once in recent
 * versions — this needs none of that, at the cost of the copy being forgotten
 * when the server stops.
 */
public class BottledChunkItem extends Item {
    private static final int SIZE = 16;
    private static final int BLOCKS_PER_TICK = 2000;
    private static final int COOLDOWN = 40;

    /** One clipboard per player. Identity is all this needs. */
    // Keyed by UUID rather than by the player object. A PlayerEntity is
    // replaced on every respawn and every dimension change, so an
    // identity-keyed map silently loses the entry the moment you die — and
    // because nothing removes entries on disconnect, it also holds the old
    // entity, and through it the whole world, for as long as the server runs.
    // A UUID is stable across both and holds nothing.
    private static final Map<java.util.UUID, BlockState[]> BOTTLES = new HashMap<>();

    public BottledChunkItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        // Aim short: at sixteen blocks across, the region wants to sit at
        // arm's length rather than wherever a 150-block ray happens to stop.
        Vec3d target = Strikes.aim(user, 40.0);
        BlockPos corner = BlockPos.ofFloored(target).add(-SIZE / 2, 0, -SIZE / 2);

        if (user.isSneaking()) {
            paste(serverWorld, user, corner);
        } else {
            copy(serverWorld, user, corner);
        }

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private void copy(ServerWorld world, PlayerEntity user, BlockPos corner) {
        BlockState[] held = new BlockState[SIZE * SIZE * SIZE];
        BlockPos.Mutable pos = new BlockPos.Mutable();
        int solid = 0;
        for (int x = 0; x < SIZE; x++) {
            for (int y = 0; y < SIZE; y++) {
                for (int z = 0; z < SIZE; z++) {
                    pos.set(corner.getX() + x, corner.getY() + y, corner.getZ() + z);
                    BlockState state = world.getBlockState(pos);
                    held[index(x, y, z)] = state;
                    if (!state.isAir()) {
                        solid++;
                    }
                }
            }
        }
        BOTTLES.put(user.getUuid(), held);
        user.sendMessage(Text.literal("§b⌸ BOTTLED — " + solid + " blocks captured"), true);
        world.playSound(null, corner, SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 1.0F, 1.5F);
        outline(world, corner);
    }

    private void paste(ServerWorld world, PlayerEntity user, BlockPos corner) {
        BlockState[] held = BOTTLES.get(user.getUuid());
        if (held == null) {
            user.sendMessage(Text.literal("§7the bottle is empty — right-click to fill it first"), true);
            return;
        }

        int[] x = {0};
        int[] placed = {0};
        BlockPos.Mutable pos = new BlockPos.Mutable();

        Scheduler.repeat(() -> {
            int budget = BLOCKS_PER_TICK;
            while (budget > 0) {
                if (x[0] >= SIZE) {
                    user.sendMessage(Text.literal("§a⌸ " + placed[0] + " blocks placed"), true);
                    return false;
                }
                for (int y = 0; y < SIZE; y++) {
                    for (int z = 0; z < SIZE; z++) {
                        BlockState state = held[index(x[0], y, z)];
                        if (state == null || state.isAir()) {
                            continue;
                        }
                        pos.set(corner.getX() + x[0], corner.getY() + y, corner.getZ() + z);
                        BlockState was = world.getBlockState(pos);
                        if (was.isOf(Blocks.BEDROCK)) {
                            continue;
                        }
                        // Through the Journal, so a paste in the wrong place is
                        // one right-click of the Rewind Clock away from gone.
                        Journal.clear(world, pos.toImmutable(), was, state);
                        placed[0]++;
                    }
                }
                budget -= SIZE * SIZE;
                x[0]++;
            }
            return true;
        });

        world.playSound(null, corner, SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 1.5F, 1.7F);
        outline(world, corner);
    }

    /** Show the region's edges so it is clear what was taken or put down. */
    private void outline(ServerWorld world, BlockPos corner) {
        for (int i = 0; i <= SIZE; i += 2) {
            for (int[] edge : new int[][] {{i, 0, 0}, {i, 0, SIZE}, {i, SIZE, 0}, {i, SIZE, SIZE},
                                           {0, i, 0}, {SIZE, i, 0}, {0, i, SIZE}, {SIZE, i, SIZE},
                                           {0, 0, i}, {SIZE, 0, i}, {0, SIZE, i}, {SIZE, SIZE, i}}) {
                Strikes.puff(world, ParticleTypes.END_ROD,
                        new Vec3d(corner.getX() + edge[0], corner.getY() + edge[1],
                                corner.getZ() + edge[2]), 1, 0.0, 0.0);
            }
        }
    }

    private static int index(int x, int y, int z) {
        return (x * SIZE + y) * SIZE + z;
    }
}
