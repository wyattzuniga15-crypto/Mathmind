package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
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

/** Two hundred cows, arriving at speed, from that direction. */
public class StampedeItem extends ArsenalItem {
    private static final int HERD = 200;
    private static final int PER_TICK = 6;
    private static final int COOLDOWN = 400;

    public StampedeItem(Settings settings) {
        super(settings, "Two hundred cows, arriving at speed, from that direction.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        double flat = Math.max(0.05, Math.sqrt(aim.x * aim.x + aim.z * aim.z));
        double ux = aim.x / flat;
        double uz = aim.z / flat;
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_LIGHTNING_BOLT_THUNDER,
                SoundCategory.MASTER, 5.0F, 1.4F);
        user.sendMessage(Text.literal("§6🐄 Move."), true);
        int[] sent = {0};
        Scheduler.repeat(() -> {
            // Spawned relative to the player, so with no player there is
            // nowhere to spawn them relative to.
            if (user.isRemoved()) {
                return false;
            }
            ThreadLocalRandom dice = ThreadLocalRandom.current();
            for (int n = 0; n < PER_TICK && sent[0] < HERD; n++, sent[0]++) {
                Entity cow = EntityType.COW.create(serverWorld, SpawnReason.EVENT);
                if (cow == null) {
                    continue;
                }
                // Spawned behind the player and pointed forward, so the herd runs
                // past rather than appearing on top of whatever it is charging.
                double back = 18.0 + dice.nextDouble(20.0);
                double side = dice.nextDouble(-10.0, 10.0);
                cow.setPosition(user.getX() - ux * back + -uz * side,
                        user.getY() + 1, user.getZ() - uz * back + ux * side);
                serverWorld.spawnEntity(cow);
                cow.setVelocity(new Vec3d(ux * 1.1, 0.1, uz * 1.1));
            }
            return sent[0] < HERD;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
