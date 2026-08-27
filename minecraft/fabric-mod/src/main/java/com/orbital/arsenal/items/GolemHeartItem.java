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

/** Wakes a stone golem. Slow, five hundred hit points, and it hits like the stone it is made of. */
public class GolemHeartItem extends ArsenalItem {
    private static final int COOLDOWN = 400;

    public GolemHeartItem(Settings settings) {
        super(settings, "Wakes a stone golem. Slow, five hundred hit points, and it hits like the stone it is made of.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Entity mob = ModEntities.GOLEM.create(serverWorld, SpawnReason.EVENT);
        if (mob == null) {
            return ActionResult.SUCCESS;
        }
        // Well clear of the player: something this size spawned at your feet is
        // inside you, and the game resolves that by shoving one of you somewhere odd.
        Vec3d ahead = user.getRotationVec(1.0F).normalize().multiply(10.0);
        mob.setPosition(user.getX() + ahead.x, user.getY() + 1, user.getZ() + ahead.z);
        serverWorld.spawnEntity(mob);
        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                mob.getX(), mob.getY() + 2, mob.getZ(), 260, 2.5, 3.0, 2.5, 0.1);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.HOSTILE, 8.0F, 0.6F);
        user.sendMessage(Text.literal("§7◈ It has woken up."), false);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
