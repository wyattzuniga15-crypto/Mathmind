package com.orbital.arsenal.items;

import com.orbital.arsenal.ModItems;
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
 * Stops the world dead. You keep moving.
 *
 * Mobs stand still mid-stride, arrows hang in the air, TNT stops counting down,
 * fluids stop flowing and the sun stops climbing — and you walk through all of
 * it, mining and building and swinging as normal.
 *
 * Right-click again to let time go before the fifteen seconds are up.
 */
public class TimeStopClockItem extends Item {
    private static final int SECONDS = 15;
    private static final int COOLDOWN = ModItems.CLOCK_COOLDOWN;

    public TimeStopClockItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        if (TimeControl.release(serverWorld.getServer())) {
            user.sendMessage(Text.literal("§7⧗ time resumes"), true);
            serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                    SoundCategory.MASTER, 1.0F, 0.7F);
            return ActionResult.SUCCESS;
        }

        if (!TimeControl.freeze(serverWorld.getServer(), SECONDS)) {
            return ActionResult.SUCCESS;
        }
        user.sendMessage(Text.literal("§b⧗ TIME STOP — " + SECONDS + "s"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 3.0F, 2.0F);
        serverWorld.spawnParticles(ParticleTypes.END_ROD,
                user.getX(), user.getY() + 1.0, user.getZ(), 80, 2.5, 2.5, 2.5, 0.0);

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
