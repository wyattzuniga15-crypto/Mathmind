package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import java.util.HashSet;
import java.util.Set;
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

/**
 * Thirty seconds of flight, on a toggle.
 *
 * A jetpack has to be a mode rather than a shove: a per-click boost is a
 * catapult, and the point of flying is going where you like while it lasts.
 * Sneaking descends, which is the one control everybody reaches for without
 * being told.
 */
public class JetpackItem extends Item {
    private static final int FUEL = 600;
    private static final double LIFT = 0.09;
    private static final double TOP_SPEED = 0.65;
    private static final int COOLDOWN = 40;

    /** Who is currently flying, so a second click lands them. */
    // Keyed by UUID rather than by the player object. A PlayerEntity is
    // replaced on every respawn and every dimension change, so an
    // identity-keyed map silently loses the entry the moment you die — and
    // because nothing removes entries on disconnect, it also holds the old
    // entity, and through it the whole world, for as long as the server runs.
    // A UUID is stable across both and holds nothing.
    private static final Set<java.util.UUID> FLYING = new HashSet<>();

    public JetpackItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        if (!FLYING.add(user.getUuid())) {
            FLYING.remove(user.getUuid());
            user.sendMessage(Text.literal("§7❂ Engines off."), true);
            return ActionResult.SUCCESS;
        }

        user.sendMessage(Text.literal("§6❂ Lift-off — thirty seconds. Sneak to descend."), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.PLAYERS, 1.0F, 1.8F);

        int[] burn = {0};
        Scheduler.repeat(() -> {
            if (!FLYING.contains(user.getUuid()) || ++burn[0] > FUEL || user.isRemoved()) {
                FLYING.remove(user.getUuid());
                user.sendMessage(Text.literal("§7❂ Out of fuel."), true);
                return false;
            }
            // Accelerate rather than set: a fixed velocity fights the player's
            // own movement and feels like being dragged.
            double rise = user.isSneaking() ? -LIFT * 1.4 : LIFT;
            user.addVelocity(0, rise, 0);
            // Cap the climb, or thirty seconds of acceleration puts you above
            // the world. Nothing here resets fall damage: that field went
            // private and its accessor has been renamed across versions, and
            // holding the player up keeps the distance near zero anyway.
            Vec3d speed = user.getVelocity();
            if (speed.y > TOP_SPEED) {
                user.setVelocity(new Vec3d(speed.x, TOP_SPEED, speed.z));
            }

            serverWorld.spawnParticles(ParticleTypes.FLAME, true, true,
                    user.getX(), user.getY() + 0.2, user.getZ(), 6, 0.2, 0.1, 0.2, 0.03);
            serverWorld.spawnParticles(ParticleTypes.SMOKE, true, true,
                    user.getX(), user.getY(), user.getZ(), 4, 0.3, 0.1, 0.3, 0.02);
            return true;
        });

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
