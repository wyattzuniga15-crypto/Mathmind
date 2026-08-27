package com.orbital.arsenal.items;

import com.orbital.arsenal.entity.ModEntities;
import net.minecraft.entity.Entity;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Rekindles a phoenix. Fast, bright, and it does not stay on the ground. */
public class PhoenixAshItem extends Item {
    private static final int COOLDOWN = 400;

    public PhoenixAshItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Entity mob = ModEntities.PHOENIX.create(serverWorld, SpawnReason.EVENT);
        if (mob == null) {
            return ActionResult.SUCCESS;
        }
        // Well clear of the player, as with the other large ones: something
        // this size spawned at your feet is inside you.
        Vec3d ahead = user.getRotationVec(1.0F).normalize().multiply(8.0);
        mob.setPosition(user.getX() + ahead.x, user.getY() + 1, user.getZ() + ahead.z);
        serverWorld.spawnEntity(mob);
        serverWorld.spawnParticles(ParticleTypes.FLAME, true, true,
                mob.getX(), mob.getY() + 2, mob.getZ(), 300, 3.0, 2.5, 3.0, 0.08);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.HOSTILE, 6.0F, 1.6F);
        user.sendMessage(Text.literal("§6✹ It is awake, and it is faster than you."), false);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
