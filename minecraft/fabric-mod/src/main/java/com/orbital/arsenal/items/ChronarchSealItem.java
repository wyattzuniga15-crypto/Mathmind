package com.orbital.arsenal.items;

import com.orbital.arsenal.boss.Chronarch;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Wakes the Chronarch where you are looking. Consumed doing it. */
public class ChronarchSealItem extends ArsenalItem {
    private static final int COOLDOWN = 200;

    public ChronarchSealItem(Settings settings) {
        super(settings, "Wakes the Chronarch where you are looking. Consumed doing it.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Vec3d at = Strikes.aim(user, 30.0);
        if (!Chronarch.summon(serverWorld, at)) {
            user.sendMessage(Text.literal("§7nothing answers"), true);
            return ActionResult.SUCCESS;
        }

        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 5.0F, 1.0F);
        user.sendMessage(Text.literal("§5✦ THE CHRONARCH WAKES"), false);
        user.sendMessage(Text.literal(
                "§7It will slow you, then start undoing its own wounds. "
                        + "§fStop time and it cannot."), false);

        ItemStack stack = user.getStackInHand(hand);
        // Spent on use. A boss you can re-summon for free is an inconvenience
        // rather than an event.
        stack.decrement(1);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
