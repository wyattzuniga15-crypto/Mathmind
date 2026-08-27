package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import java.util.HashMap;
import java.util.Map;
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

/** A rock that follows you everywhere. It is not good for anything. */
public class PetRockItem extends Item {
    /** Where each player's rock currently sits. */
    private static final Map<PlayerEntity, BlockPos> ROCKS = new HashMap<>();
    private static final int COOLDOWN = 40;

    public PetRockItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        if (ROCKS.containsKey(user)) {
            // Second click: leave it where it stands.
            BlockPos resting = ROCKS.remove(user);
            BlockState was = serverWorld.getBlockState(resting);
            if (was.isOf(Blocks.MOSSY_COBBLESTONE)) {
                Journal.clear(serverWorld, resting, was, Blocks.AIR.getDefaultState());
            }
            user.sendMessage(Text.literal("§7\u1FAA8 It stays behind. It does not mind."), true);
            return ActionResult.SUCCESS;
        }

        user.sendMessage(Text.literal("§7\u1FAA8 It is a rock. It follows you."), true);
        ROCKS.put(user, BlockPos.ofFloored(user.getX(), user.getY(), user.getZ()));
        Scheduler.repeat(() -> {
            BlockPos wasAt = ROCKS.get(user);
            if (wasAt == null || user.isRemoved()) {
                return false;
            }
            BlockPos goesTo = BlockPos.ofFloored(user.getX() - 1.5, user.getY(), user.getZ() - 1.5);
            if (wasAt.equals(goesTo)) {
                return true;
            }
            // Clear where it was before placing where it goes. Placing first
            // leaves a trail of rocks behind the player rather than one rock
            // following them.
            BlockState there = serverWorld.getBlockState(wasAt);
            if (there.isOf(Blocks.MOSSY_COBBLESTONE)) {
                Journal.clear(serverWorld, wasAt, there, Blocks.AIR.getDefaultState());
            }
            BlockState target = serverWorld.getBlockState(goesTo);
            if (target.isAir()) {
                Journal.clear(serverWorld, goesTo, target, Blocks.MOSSY_COBBLESTONE.getDefaultState());
                ROCKS.put(user, goesTo);
            }
            return true;
        });

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
