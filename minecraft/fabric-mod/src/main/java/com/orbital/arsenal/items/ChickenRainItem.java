package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
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

/** It rains chickens. Two hundred of them. */
public class ChickenRainItem extends Item {
    private static final int BIRDS = 200;
    private static final int PER_TICK = 5;
    private static final double SPREAD = 22.0;
    private static final int COOLDOWN = 400;

    public ChickenRainItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_CAT_HISS,
                SoundCategory.MASTER, 3.0F, 1.6F);
        user.sendMessage(Text.literal("§e🐔 Look up."), true);
        int[] sent = {0};
        Scheduler.repeat(() -> {
            // Spawned relative to the player, so with no player there is
            // nowhere to spawn them relative to.
            if (user.isRemoved()) {
                return false;
            }
            ThreadLocalRandom dice = ThreadLocalRandom.current();
            for (int n = 0; n < PER_TICK && sent[0] < BIRDS; n++, sent[0]++) {
                Entity bird = EntityType.CHICKEN.create(serverWorld, SpawnReason.EVENT);
                if (bird == null) {
                    continue;
                }
                // Chickens fall slowly on their own, so no parachute is needed and
                // none survives being given one. Spread over a disc so they do not
                // all land in one pile.
                double a = dice.nextDouble() * Math.PI * 2;
                double r = Math.sqrt(dice.nextDouble()) * SPREAD;
                bird.setPosition(user.getX() + Math.cos(a) * r,
                        user.getY() + 30 + dice.nextDouble(10),
                        user.getZ() + Math.sin(a) * r);
                serverWorld.spawnEntity(bird);
            }
            return sent[0] < BIRDS;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
