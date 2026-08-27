package com.orbital.arsenal.items;

import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
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

/** Turns every living thing near you to stone. Permanently. */
public class FossiliseItem extends Item {
    private static final double REACH = 24.0;
    private static final int COOLDOWN = 300;

    public FossiliseItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d here = new Vec3d(user.getX(), user.getY(), user.getZ());
        int caught = 0;
        for (Entity thing : Area.mobs(serverWorld, user, here, REACH)) {
            if (!(thing instanceof LivingEntity)) {
                continue;
            }
            // A statue where it stood, then the creature removed. Leaving both
            // would give you a stone mob that still walks around inside its statue.
            int bx = (int) Math.floor(thing.getX());
            int by = (int) Math.floor(thing.getY());
            int bz = (int) Math.floor(thing.getZ());
            for (int y = 0; y < 2; y++) {
                BlockPos spot = new BlockPos(bx, by + y, bz);
                BlockState was = serverWorld.getBlockState(spot);
                if (was.isAir()) {
                    Journal.clear(serverWorld, spot, was, Blocks.STONE.getDefaultState());
                }
            }
            serverWorld.spawnParticles(ParticleTypes.POOF, true, true,
                    thing.getX(), thing.getY() + 1, thing.getZ(), 20, 0.3, 0.5, 0.3, 0.02);
            thing.discard();
            caught++;
        }
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 4.0F, 0.9F);
        user.sendMessage(Text.literal("§7⬖ " + caught + " turned to stone"), true);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
