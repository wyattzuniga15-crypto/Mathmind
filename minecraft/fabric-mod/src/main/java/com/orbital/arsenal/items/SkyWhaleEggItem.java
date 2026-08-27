package com.orbital.arsenal.items;

import com.orbital.arsenal.entity.ModEntities;
import net.minecraft.entity.Entity;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Calls down a sky whale. It is five blocks long, entirely peaceful, and will drift over your world for as long as you leave it alone. */
public class SkyWhaleEggItem extends ArsenalItem {
    private static final int COOLDOWN = 200;

    public SkyWhaleEggItem(Settings settings) {
        super(settings, "Calls down a sky whale. It is five blocks long, entirely peaceful, and will drift over your world for as long as you leave it alone.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Entity whale = ModEntities.SKY_WHALE.create(serverWorld, SpawnReason.EVENT);
        if (whale == null) {
            return ActionResult.SUCCESS;
        }
        // Well clear and well above: something five blocks long spawned at your
        // feet is inside you, and the game will shove one of you somewhere odd.
        Vec3d ahead = user.getRotationVec(1.0F).normalize().multiply(12.0);
        whale.setPosition(user.getX() + ahead.x, user.getY() + 14, user.getZ() + ahead.z);
        serverWorld.spawnEntity(whale);
        serverWorld.spawnParticles(ParticleTypes.CLOUD, true, true,
                whale.getX(), whale.getY(), whale.getZ(), 200, 4.0, 2.0, 4.0, 0.05);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.NEUTRAL, 4.0F, 0.35F);
        user.sendMessage(Text.literal("§b🐋 Look up."), true);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
