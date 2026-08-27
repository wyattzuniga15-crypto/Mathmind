package com.orbital.arsenal.items;

import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.attribute.EntityAttributeInstance;
import net.minecraft.entity.attribute.EntityAttributes;
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

/**
 * Calls up a double of you that fights on your side.
 *
 * It is an iron golem underneath, scaled to your height and wearing your name.
 * That is a deliberate choice rather than a shortcut: a golem already hunts
 * hostile mobs and already refuses to hit the player, which is exactly what
 * "a copy of me that fights for me" has to do. Writing that from scratch would
 * take a custom brain and arrive at the same behaviour.
 */
public class DoppelgangerItem extends Item {
    private static final double SCALE = 0.62;
    private static final int COOLDOWN = 100;

    public DoppelgangerItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Entity spawned = EntityType.IRON_GOLEM.create(serverWorld, SpawnReason.EVENT);
        if (!(spawned instanceof LivingEntity twin)) {
            return ActionResult.SUCCESS;
        }

        Vec3d beside = user.getRotationVec(1.0F).normalize().multiply(2.5);
        twin.setPosition(user.getX() + beside.x, user.getY(), user.getZ() + beside.z);
        twin.setCustomName(Text.literal(user.getName().getString() + " ②"));

        EntityAttributeInstance scale = twin.getAttributeInstance(EntityAttributes.SCALE);
        if (scale != null) {
            scale.setBaseValue(SCALE);
        }
        serverWorld.spawnEntity(twin);

        serverWorld.spawnParticles(ParticleTypes.SOUL_FIRE_FLAME, true, true,
                twin.getX(), twin.getY() + 1.0, twin.getZ(), 60, 0.5, 1.0, 0.5, 0.05);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.PLAYERS, 1.5F, 0.5F);
        user.sendMessage(Text.literal("§b② Another you. Use it again for another."), true);

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
