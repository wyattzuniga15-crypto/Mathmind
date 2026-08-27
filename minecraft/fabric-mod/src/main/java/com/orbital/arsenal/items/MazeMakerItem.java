package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Builds a real maze around you — walls on a grid, with gaps you have to find. */
public class MazeMakerItem extends ArsenalItem {
    private static final int CELLS = 12;
    private static final int CELL = 4;
    private static final int WALL = 5;
    private static final int COOLDOWN = 400;

    public MazeMakerItem(Settings settings) {
        super(settings, "Builds a real maze around you — walls on a grid, with gaps you have to find.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX()) - CELLS * CELL / 2;
        int cz = (int) Math.floor(user.getZ()) - CELLS * CELL / 2;
        int ground = Area.surface(serverWorld, (int) user.getX(), (int) user.getZ(),
                (int) user.getY()) + 1;
        user.sendMessage(Text.literal("§8▦ Find your way out."), true);
        ThreadLocalRandom dice = ThreadLocalRandom.current();
        // Walls on a grid with a random gap in each: not a perfect maze, but one
        // that is actually walkable. A true maze generator would leave dead ends
        // you can only escape by breaking blocks.
        for (int i = 0; i <= CELLS; i++) {
            for (int j = 0; j < CELLS * CELL; j++) {
                boolean gapA = j % CELL == dice.nextInt(CELL);
                for (int y = 0; y < WALL; y++) {
                    if (!gapA) {
                        BlockPos a = new BlockPos(cx + i * CELL, ground + y, cz + j);
                        Journal.clear(serverWorld, a, serverWorld.getBlockState(a),
                                Blocks.STONE_BRICKS.getDefaultState());
                    }
                    boolean gapB = j % CELL == dice.nextInt(CELL);
                    if (!gapB) {
                        BlockPos b = new BlockPos(cx + j, ground + y, cz + i * CELL);
                        Journal.clear(serverWorld, b, serverWorld.getBlockState(b),
                                Blocks.STONE_BRICKS.getDefaultState());
                    }
                }
            }
        }
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 4.0F, 1.2F);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
