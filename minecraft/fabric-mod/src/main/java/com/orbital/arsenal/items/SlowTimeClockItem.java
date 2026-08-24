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
 * Drops the world to a quarter speed while you carry on at your own.
 *
 * Where the Time Stop Clock is absolute, this one leaves the world moving —
 * mobs still come for you, just slowly enough to walk around. Arrows crawl. A
 * lit TNT gives you four times as long to get clear.
 *
 * Right-click again to bring the world back up to speed early.
 */
public class SlowTimeClockItem extends Item {
    private static final int SECONDS = 20;
    /** A quarter of the normal twenty ticks a second. */
    private static final float RATE = 5.0f;
    private static final int COOLDOWN = 300;

    public SlowTimeClockItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        if (TimeControl.release(serverWorld.getServer())) {
            user.sendMessage(Text.literal("§7◷ back up to speed"), true);
            return ActionResult.SUCCESS;
        }

        if (!TimeControl.slow(serverWorld.getServer(), SECONDS, RATE)) {
            return ActionResult.SUCCESS;
        }
        user.sendMessage(Text.literal("§3◷ SLOW MOTION — quarter speed for " + SECONDS + "s"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 2.0F, 0.4F);
        serverWorld.spawnParticles(ParticleTypes.SOUL_FIRE_FLAME,
                user.getX(), user.getY() + 1.0, user.getZ(), 50, 2.0, 2.0, 2.0, 0.0);

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
