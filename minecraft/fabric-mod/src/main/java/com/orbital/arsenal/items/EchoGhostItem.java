package com.orbital.arsenal.items;

import com.orbital.arsenal.echo.Echoes;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/**
 * One press, one ghost. Press again for another, and so on.
 *
 * Each ghost replays the ten seconds you had just lived when you made it, so
 * they are not copies of each other — walk somewhere, press, walk somewhere
 * else, press, and the two of them are doing different things at once.
 *
 * Crouch and right-click to send them all away.
 */
public class EchoGhostItem extends Item {
    /** Short, because pressing repeatedly to raise a crowd is the point. */
    private static final int COOLDOWN = 20;

    public EchoGhostItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld) || !(user instanceof ServerPlayerEntity player)) {
            return ActionResult.SUCCESS;
        }

        if (player.isSneaking()) {
            int gone = Echoes.dismiss(player);
            player.sendMessage(Text.literal(gone == 0
                    ? "§7no echoes to dismiss"
                    : "§7☠ " + gone + " echoes dismissed"), true);
            return ActionResult.SUCCESS;
        }

        int total = Echoes.spawn(player);
        if (total == 0) {
            // Nothing recorded yet — a player who logged in a second ago has no
            // past to replay, and saying so beats a press that does nothing.
            player.sendMessage(Text.literal("§7nothing to echo yet — move around first"), true);
            return ActionResult.SUCCESS;
        }

        player.sendMessage(Text.literal("§d◈ ECHO — " + total + " walking"), true);
        serverWorld.playSound(null, player.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 1.5F, 1.9F);
        serverWorld.spawnParticles(ParticleTypes.SOUL_FIRE_FLAME,
                player.getX(), player.getY() + 1.0, player.getZ(), 40, 0.8, 1.2, 0.8, 0.01);

        ItemStack stack = player.getStackInHand(hand);
        player.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
