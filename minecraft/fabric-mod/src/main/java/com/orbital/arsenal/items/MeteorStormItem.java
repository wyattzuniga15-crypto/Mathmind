package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Shells;
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
import net.minecraft.world.World;

/**
 * A bombardment that follows you for a minute.
 *
 * Every other weapon here is aimed once. This one tracks the player, so the
 * apocalypse is wherever you walk — which is a different feeling entirely, and
 * the only reason it needs to exist alongside the strike cannon.
 *
 * Meteors fall a few per tick rather than in waves, because a wave lands in
 * one instant and reads as a single explosion; a trickle reads as weather.
 */
public class MeteorStormItem extends Item {
    private static final int DURATION = 1_200;
    private static final int EVERY = 6;
    private static final int PER_VOLLEY = 3;
    private static final double SPREAD = 30.0;
    private static final int DROP_HEIGHT = 70;
    private static final int COOLDOWN = 400;

    public MeteorStormItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        user.sendMessage(Text.literal("§c☄ METEOR STORM — one minute, and it follows you"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 4.0F, 0.5F);

        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION || user.isRemoved()) {
                user.sendMessage(Text.literal("§7☄ The sky is quiet again."), true);
                return false;
            }
            if (age[0] % EVERY != 0) {
                return true;
            }
            ThreadLocalRandom dice = ThreadLocalRandom.current();
            for (int i = 0; i < PER_VOLLEY; i++) {
                // A ring rather than a disc: uniform x/z would cluster around
                // the player's feet, which is where they are standing.
                double angle = dice.nextDouble() * Math.PI * 2;
                double r = 8.0 + dice.nextDouble() * SPREAD;
                // Shells detonate on impact rather than on a fuse — the only
                // thing that works when the ground below is at any height.
                Shells.drop(serverWorld,
                        user.getX() + Math.cos(angle) * r,
                        user.getY() + DROP_HEIGHT,
                        user.getZ() + Math.sin(angle) * r);
            }
            serverWorld.spawnParticles(ParticleTypes.FLAME, true, true,
                    user.getX(), user.getY() + DROP_HEIGHT * 0.6, user.getZ(),
                    20, SPREAD * 0.5, 6.0, SPREAD * 0.5, 0.1);
            return true;
        });

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
