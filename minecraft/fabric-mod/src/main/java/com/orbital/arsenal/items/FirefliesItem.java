package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import java.util.concurrent.ThreadLocalRandom;
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

/** A drift of lights around you for two minutes. They follow you about. */
public class FirefliesItem extends Item {
    private static final int DURATION = 2400;
    private static final int LIGHTS = 40;
    private static final double REACH = 12.0;
    private static final int COOLDOWN = 300;

    public FirefliesItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 1.0F, 1.9F);
        user.sendMessage(Text.literal("§e∴ Fireflies."), true);
        // Each light gets its own drift, held in three arrays rather than spawned
        // fresh every tick: particles picked at random each tick flicker as a cloud
        // rather than moving as individual lights, which is not the same thing.
        double[] px = new double[LIGHTS];
        double[] py = new double[LIGHTS];
        double[] pz = new double[LIGHTS];
        ThreadLocalRandom dice = ThreadLocalRandom.current();
        for (int i = 0; i < LIGHTS; i++) {
            px[i] = dice.nextDouble(-REACH, REACH);
            py[i] = dice.nextDouble(0.5, 5.0);
            pz[i] = dice.nextDouble(-REACH, REACH);
        }
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION || user.isRemoved()) {
                return false;
            }
            // Every other tick. Forty separate packets every tick for two minutes
            // is ninety-six thousand of them, and nothing about a drifting light
            // needs redrawing twenty times a second.
            if (age[0] % 2 != 0) {
                return true;
            }
            for (int i = 0; i < LIGHTS; i++) {
                double t = age[0] * 0.05 + i;
                double dx = px[i] + Math.sin(t) * 1.5;
                double dz = pz[i] + Math.cos(t * 0.8) * 1.5;
                double dy = py[i] + Math.sin(t * 1.3) * 0.6;
                serverWorld.spawnParticles(ParticleTypes.GLOW, true, true,
                        user.getX() + dx, user.getY() + dy, user.getZ() + dz,
                        1, 0.0, 0.0, 0.0, 0.0);
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
