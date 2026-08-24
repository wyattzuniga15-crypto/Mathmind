package com.orbital.arsenal.items;

import com.orbital.arsenal.time.TimeControl;
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
import net.minecraft.world.World;

/**
 * The third clock, and the one that builds rather than waits.
 *
 * Runs the world at five times speed: crops mature while you watch, furnaces
 * burn through a stack, mobs breed, and a night passes in a couple of minutes.
 * Right-click again to drop back to normal.
 *
 * Fifteen seconds rather than the slow clock's twenty, because this is the
 * expensive direction — the server genuinely does five times the work per
 * second while it runs, and that is felt on a machine that was keeping up
 * comfortably at normal speed.
 */
public class FastForwardClockItem extends Item {
    private static final int SECONDS = 15;
    /** Five times the normal twenty ticks a second. */
    private static final float RATE = 100.0f;
    private static final int COOLDOWN = 400;

    public FastForwardClockItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        if (TimeControl.release(serverWorld.getServer())) {
            user.sendMessage(Text.literal("§7⏩ back to normal speed"), true);
            return ActionResult.SUCCESS;
        }

        if (!TimeControl.fast(serverWorld.getServer(), SECONDS, RATE)) {
            return ActionResult.SUCCESS;
        }
        user.sendMessage(Text.literal("§6⏩ FAST FORWARD — five times speed for " + SECONDS + "s"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 2.0F, 1.8F);
        serverWorld.spawnParticles(ParticleTypes.FLAME,
                user.getX(), user.getY() + 1.0, user.getZ(), 40, 1.5, 1.5, 1.5, 0.02);

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
