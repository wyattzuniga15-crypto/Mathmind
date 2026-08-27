package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LivingEntity;
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
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * A storm that walks with you, and hunts.
 *
 * Bolts prefer a living target over open ground: a storm that struck at
 * random would mostly hit dirt, and the whole appeal is watching it pick
 * things off. It only falls back to a random spot when there is nothing
 * within reach, so it never simply stops.
 */
public class LightningCallerItem extends Item {
    private static final int DURATION = 900;
    private static final int EVERY = 10;
    private static final double REACH = 26.0;
    private static final int COOLDOWN = 300;

    public LightningCallerItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        user.sendMessage(Text.literal("§e⚡ The sky follows you now."), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_LIGHTNING_BOLT_THUNDER,
                SoundCategory.WEATHER, 6.0F, 0.7F);

        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION || user.isRemoved()) {
                user.sendMessage(Text.literal("§7⚡ The storm passes."), true);
                return false;
            }
            if (age[0] % EVERY != 0) {
                return true;
            }

            Box around = new Box(user.getX() - REACH, user.getY() - 20, user.getZ() - REACH,
                    user.getX() + REACH, user.getY() + 20, user.getZ() + REACH);
            Entity target = null;
            for (Entity candidate : serverWorld.getOtherEntities(user, around)) {
                if (candidate instanceof LivingEntity) {
                    target = candidate;
                    break;
                }
            }

            double x;
            double y;
            double z;
            if (target != null) {
                x = target.getX();
                y = target.getY();
                z = target.getZ();
            } else {
                ThreadLocalRandom dice = ThreadLocalRandom.current();
                double angle = dice.nextDouble() * Math.PI * 2;
                double r = 6.0 + dice.nextDouble() * REACH;
                x = user.getX() + Math.cos(angle) * r;
                y = user.getY();
                z = user.getZ() + Math.sin(angle) * r;
            }

            Entity bolt = EntityType.LIGHTNING_BOLT.create(serverWorld, SpawnReason.EVENT);
            if (bolt != null) {
                bolt.setPosition(x, y, z);
                serverWorld.spawnEntity(bolt);
            }
            serverWorld.spawnParticles(ParticleTypes.ELECTRIC_SPARK, true, true,
                    x, y + 1, z, 40, 1.0, 2.0, 1.0, 0.2);
            return true;
        });

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
