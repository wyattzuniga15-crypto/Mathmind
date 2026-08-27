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

/** Hatches a dragon. Six blocks of wingspan, fast, and it hits harder than anything else that flies. */
public class DragonEggItem extends Item {
    private static final int COOLDOWN = 400;

    public DragonEggItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Entity mob = ModEntities.DRAGON.create(serverWorld, SpawnReason.EVENT);
        if (mob == null) {
            return ActionResult.SUCCESS;
        }
        // Well clear of the player: something this size spawned at your feet is
        // inside you, and the game resolves that by shoving one of you somewhere odd.
        Vec3d ahead = user.getRotationVec(1.0F).normalize().multiply(14.0);
        mob.setPosition(user.getX() + ahead.x, user.getY() + 6, user.getZ() + ahead.z);
        serverWorld.spawnEntity(mob);
        serverWorld.spawnParticles(ParticleTypes.FLAME, true, true,
                mob.getX(), mob.getY() + 2, mob.getZ(), 260, 2.5, 3.0, 2.5, 0.1);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.HOSTILE, 8.0F, 0.5F);
        user.sendMessage(Text.literal("§c🐉 It is already looking at you."), false);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
