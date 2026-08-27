package com.orbital.arsenal.items;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/** Cycles the time: dawn, noon, dusk, midnight. */
public class TimeOfDayItem extends Item {
    private static final long[] TIMES = {1_000L, 6_000L, 12_000L, 18_000L};
    private static final String[] NAMES = {"Dawn.", "Noon.", "Dusk.", "Midnight."};
    private static int mode = 0;
    private static final int COOLDOWN = 40;

    public TimeOfDayItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        // Set on the overworld rather than the world the player happens to be in:
        // the sun the player cares about is the overworld's, wherever they stand.
        serverWorld.setTimeOfDay(TIMES[mode]);
        user.sendMessage(Text.literal("§e☀ " + NAMES[mode]), true);
        mode = (mode + 1) % TIMES.length;
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 2.0F, 1.0F);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
