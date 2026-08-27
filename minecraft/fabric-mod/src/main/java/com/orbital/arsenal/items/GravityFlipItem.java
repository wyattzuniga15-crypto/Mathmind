package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Box;
import net.minecraft.world.World;

/**
 * Turns gravity off over a wide area for twenty seconds.
 *
 * Nothing here reverses gravity, because there is no such switch — instead
 * every entity in range is pushed up by slightly more than it falls, each
 * tick. The result is indistinguishable from the inside and needs no engine
 * changes at all.
 *
 * When it ends the push stops and everything comes down at once, which is the
 * good part.
 */
public class GravityFlipItem extends ArsenalItem {
    private static final int DURATION = 400;
    private static final double REACH = 40.0;
    /** Minecraft pulls entities down about 0.08/tick; a touch more lifts. */
    private static final double PUSH = 0.11;
    private static final double CEILING = 0.85;
    private static final int COOLDOWN = 300;

    public GravityFlipItem(Settings settings) {
        super(settings, "Turns gravity off over a wide area for twenty seconds.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        user.sendMessage(Text.literal("§5↑ UP IS DOWN — twenty seconds"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 6.0F, 0.5F);

        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION || user.isRemoved()) {
                user.sendMessage(Text.literal("§7↓ …and down it all comes."), true);
                return false;
            }
            Box area = new Box(user.getX() - REACH, user.getY() - REACH, user.getZ() - REACH,
                    user.getX() + REACH, user.getY() + REACH, user.getZ() + REACH);
            for (Entity floating : serverWorld.getOtherEntities(null, area)) {
                // Capped, or twenty seconds of push sends everything out of
                // the world and it never comes back down.
                if (floating.getVelocity().y < CEILING) {
                    floating.addVelocity(0, PUSH, 0);
                }
            }
            if (age[0] % 5 == 0) {
                serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                        user.getX(), user.getY() + 2, user.getZ(),
                        40, REACH * 0.4, REACH * 0.3, REACH * 0.4, 0.05);
            }
            return true;
        });

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
