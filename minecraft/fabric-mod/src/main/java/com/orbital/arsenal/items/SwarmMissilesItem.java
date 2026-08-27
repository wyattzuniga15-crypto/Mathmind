package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Shells;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
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

/** Twenty missiles that pick their own targets and chase them down. */
public class SwarmMissilesItem extends Item {
    private static final int MISSILES = 20;
    private static final double HUNT = 48.0;
    private static final int COOLDOWN = 240;

    public SwarmMissilesItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int found = 0;
        Vec3d here = new Vec3d(user.getX(), user.getY(), user.getZ());
        for (Entity target : Area.living(serverWorld, user, here, HUNT)) {
            if (!(target instanceof LivingEntity)) {
                continue;
            }
            if (found >= MISSILES) {
                break;
            }
            found++;
            // One shell dropped directly above each target, which is a homing
            // missile as far as anyone watching is concerned, and needs no guidance
            // loop that could lose its target mid-flight.
            Shells.drop(serverWorld, target.getX(), target.getY() + 40, target.getZ());
            serverWorld.spawnParticles(ParticleTypes.FLAME, true, true,
                    target.getX(), target.getY() + 20, target.getZ(), 30, 0.5, 6.0, 0.5, 0.1);
        }
        user.sendMessage(Text.literal(found == 0
                ? "§7No targets in range."
                : "§c⇶ " + found + " locked"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 3.0F, 1.6F);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
