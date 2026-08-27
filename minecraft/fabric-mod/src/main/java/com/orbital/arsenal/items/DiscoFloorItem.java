package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Lays a floor of coloured glass that keeps changing colour under your feet. */
public class DiscoFloorItem extends Item {
    private static final int RADIUS = 10;
    private static final int DURATION = 800;
    private static final int COOLDOWN = 300;

    public DiscoFloorItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int ground = Area.surface(serverWorld, cx, cz, (int) user.getY());
        Block[] colours = {Blocks.RED_CONCRETE, Blocks.ORANGE_CONCRETE, Blocks.YELLOW_CONCRETE,
                Blocks.PINK_CONCRETE, Blocks.WHITE_CONCRETE, Blocks.BLACK_CONCRETE};
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 2.0F, 1.8F);
        user.sendMessage(Text.literal("§d♬ Dance."), true);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION) {
                return false;
            }
            if (age[0] % 8 != 0) {
                return true;
            }
            for (int x = -RADIUS; x <= RADIUS; x++) {
                for (int z = -RADIUS; z <= RADIUS; z++) {
                    if (x * x + z * z > RADIUS * RADIUS) {
                        continue;
                    }
                    // Colour by distance plus time, which makes rings that travel
                    // outward — a random colour per tile is just noise.
                    int band = (int) (Math.sqrt(x * x + z * z) + age[0] / 8.0);
                    BlockPos tile = new BlockPos(cx + x, ground, cz + z);
                    BlockState becomes = colours[Math.floorMod(band, colours.length)].getDefaultState();
                    BlockState was = serverWorld.getBlockState(tile);
                    if (was != becomes) {
                        Journal.clear(serverWorld, tile, was, becomes);
                    }
                }
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
