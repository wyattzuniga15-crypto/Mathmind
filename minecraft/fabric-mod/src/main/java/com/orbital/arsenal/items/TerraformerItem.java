package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.block.Block;
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
 * Repaints the land into another climate. Click to cycle: desert, snow, Nether.
 *
 * It does not change the biome — that would recolour the grass and the sky and
 * leave the ground exactly as it was, which is the opposite of what anyone
 * wants. It swaps the blocks themselves, which is the part you can see.
 *
 * Only surfaces are touched, found by walking down each column to the first
 * solid block. Repainting a solid volume would turn the inside of every hill
 * to sand and hollow the world out from under you.
 */
public class TerraformerItem extends Item {
    private static final int RADIUS = 30;
    private static final int PER_TICK = 600;
    private static final int COOLDOWN = 100;

    /** Which climate the next click paints. Cycles, so one item does all. */
    private static int mode = 0;
    private static final String[] NAMES = {"desert", "snowfield", "the Nether"};

    public TerraformerItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        int painting = mode;
        mode = (mode + 1) % NAMES.length;

        Vec3d target = Strikes.aim(user, 120.0);
        int cx = (int) Math.floor(target.x);
        int cy = (int) Math.floor(target.y);
        int cz = (int) Math.floor(target.z);

        user.sendMessage(Text.literal("§a❖ Painting " + NAMES[painting] + "…"), true);
        serverWorld.playSound(null, BlockPos.ofFloored(target), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 3.0F, 0.7F);

        int[] x = {-RADIUS};
        BlockPos.Mutable pos = new BlockPos.Mutable();

        Scheduler.repeat(() -> {
            int budget = PER_TICK;
            while (budget > 0) {
                if (x[0] > RADIUS) {
                    user.sendMessage(Text.literal("§a❖ Done."), true);
                    return false;
                }
                int half = (int) Math.sqrt(Math.max(0.0,
                        (double) RADIUS * RADIUS - (double) x[0] * x[0]));
                for (int z = -half; z <= half; z++) {
                    // Walk down for the surface: only what you can see changes.
                    for (int y = cy + 24; y > cy - 24; y--) {
                        pos.set(cx + x[0], y, cz + z);
                        BlockState state = serverWorld.getBlockState(pos);
                        if (state.isAir() || state.isOf(Blocks.BEDROCK)) {
                            continue;
                        }
                        BlockPos here = pos.toImmutable();
                        Journal.clear(serverWorld, here, state, top(painting));
                        // A little depth, so a cliff face is not still grass.
                        for (int under = 1; under <= 3; under++) {
                            BlockPos below = here.down(under);
                            BlockState was = serverWorld.getBlockState(below);
                            if (!was.isAir() && !was.isOf(Blocks.BEDROCK)) {
                                Journal.clear(serverWorld, below, was, under(painting));
                            }
                        }
                        break;
                    }
                }
                budget -= (2 * half + 1);
                x[0]++;
            }
            serverWorld.spawnParticles(ParticleTypes.HAPPY_VILLAGER, true, true,
                    target.x, cy + 3, target.z, 30, RADIUS * 0.4, 2.0, RADIUS * 0.4, 0.02);
            return true;
        });

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static BlockState top(int painting) {
        Block block = switch (painting) {
            case 0 -> Blocks.SAND;
            case 1 -> Blocks.SNOW_BLOCK;
            default -> Blocks.NETHERRACK;
        };
        return block.getDefaultState();
    }

    private static BlockState under(int painting) {
        Block block = switch (painting) {
            case 0 -> Blocks.SANDSTONE;
            case 1 -> Blocks.PACKED_ICE;
            default -> Blocks.NETHERRACK;
        };
        return block.getDefaultState();
    }
}
