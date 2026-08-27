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

/** Summons a Titan: seven blocks of bronze humanoid with six hundred hit points and a very bad attitude. */
public class TitanSealItem extends Item {
    private static final int COOLDOWN = 400;

    public TitanSealItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Entity titan = ModEntities.TITAN.create(serverWorld, SpawnReason.EVENT);
        if (titan == null) {
            return ActionResult.SUCCESS;
        }
        Vec3d ahead = user.getRotationVec(1.0F).normalize().multiply(10.0);
        titan.setPosition(user.getX() + ahead.x, user.getY(), user.getZ() + ahead.z);
        serverWorld.spawnEntity(titan);
        serverWorld.spawnParticles(ParticleTypes.SOUL_FIRE_FLAME, true, true,
                titan.getX(), titan.getY() + 3, titan.getZ(), 300, 2.0, 4.0, 2.0, 0.1);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.HOSTILE, 8.0F, 0.4F);
        user.sendMessage(Text.literal("§6⚔ It has noticed you."), false);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
