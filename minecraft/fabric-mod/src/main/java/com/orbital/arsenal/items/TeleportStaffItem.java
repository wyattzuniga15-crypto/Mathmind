package com.orbital.arsenal.items;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Puts you wherever you are looking, up to two hundred blocks away. */
public class TeleportStaffItem extends ArsenalItem {
    private static final double RANGE = 200.0;
    private static final int COOLDOWN = 40;

    public TeleportStaffItem(Settings settings) {
        super(settings, "Puts you wherever you are looking, up to two hundred blocks away.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        HitResult target = user.raycast(RANGE, 1.0F, false);
        Vec3d to = target.getPos();
        // Step back along the aim before landing: a raycast stops *at* the block
        // face, and arriving there puts you inside the wall you were looking at.
        Vec3d back = user.getRotationVec(1.0F).normalize().multiply(1.5);
        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                user.getX(), user.getY() + 1, user.getZ(), 60, 0.4, 1.0, 0.4, 0.1);
        user.setPosition(to.x - back.x, to.y, to.z - back.z);
        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                user.getX(), user.getY() + 1, user.getZ(), 60, 0.4, 1.0, 0.4, 0.1);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.PLAYERS, 1.0F, 1.2F);
        user.sendMessage(Text.literal("§5✦"), true);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
