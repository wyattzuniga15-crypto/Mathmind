package com.orbital.arsenal.items;

import com.orbital.arsenal.GrowingCats;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Puts down a kitten that will not stop getting bigger. */
public class GrowingCatItem extends Item {
    private static final int COOLDOWN = 40;

    public GrowingCatItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Entity spawned = EntityType.CAT.create(serverWorld, SpawnReason.EVENT);
        if (!(spawned instanceof LivingEntity cat)) {
            return ActionResult.SUCCESS;
        }

        // Just in front of the player, so it does not appear inside them.
        Vec3d ahead = user.getRotationVec(1.0F).normalize().multiply(2.0);
        cat.setPosition(user.getX() + ahead.x, user.getY(), user.getZ() + ahead.z);
        serverWorld.spawnEntity(cat);
        GrowingCats.adopt(cat);

        serverWorld.spawnParticles(ParticleTypes.HAPPY_VILLAGER, true, true,
                cat.getX(), cat.getY() + 0.5, cat.getZ(), 20, 0.4, 0.4, 0.4, 0.02);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_CAT_PURREOW,
                SoundCategory.NEUTRAL, 1.5F, 1.6F);
        user.sendMessage(Text.literal(
                "§d🐈 A kitten. It grows for fifteen minutes — don't leave it indoors."), true);

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
