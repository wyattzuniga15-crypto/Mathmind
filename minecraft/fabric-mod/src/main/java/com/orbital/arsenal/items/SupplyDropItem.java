package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
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

/** Calls down a crate of useful things, wherever you are looking. */
public class SupplyDropItem extends Item {
    private static final int COOLDOWN = 400;

    public SupplyDropItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 120.0);
        int cx = (int) Math.floor(at.x);
        int cy = (int) Math.floor(at.y) + 1;
        int cz = (int) Math.floor(at.z);
        // A real chest, placed on the ground, rather than items scattered loose:
        // loose items despawn in five minutes and roll into water.
        BlockPos spot = new BlockPos(cx, cy, cz);
        Journal.clear(serverWorld, spot, serverWorld.getBlockState(spot),
                Blocks.CHEST.getDefaultState());
        for (int dx = -1; dx <= 1; dx++) {
            for (int dz = -1; dz <= 1; dz++) {
                BlockPos mark = new BlockPos(cx + dx, cy - 1, cz + dz);
                BlockState was = serverWorld.getBlockState(mark);
                if (!was.isOf(Blocks.BEDROCK)) {
                    Journal.clear(serverWorld, mark, was, Blocks.QUARTZ_BLOCK.getDefaultState());
                }
            }
        }
        serverWorld.spawnParticles(ParticleTypes.CLOUD, true, true,
                at.x, at.y + 6, at.z, 120, 2.0, 4.0, 2.0, 0.05);
        serverWorld.playSound(null, spot, SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 3.0F, 0.8F);
        user.sendMessage(Text.literal("§a▣ Supply drop."), true);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
