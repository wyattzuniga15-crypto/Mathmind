package com.orbital.arsenal.items;

import com.orbital.arsenal.echo.Echoes;
import net.minecraft.entity.player.PlayerEntity;
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
 * What the Chronarch was using on you, now yours: rewind *yourself*.
 *
 * Right-click and you snap back to where you stood ten seconds ago with the
 * health you had then. Step off a cliff and undo it. Walk into a fight that
 * turns out to be a mistake and leave before you made it.
 *
 * It rewinds you and nothing else, which is the whole reason it is not just a
 * smaller Rewind Clock. The world keeps whatever happened; only you go back.
 */
public class ChronarchHeartItem extends ArsenalItem {
    private static final int COOLDOWN = 600;

    public ChronarchHeartItem(Settings settings) {
        super(settings, "What the Chronarch was using on you, now yours: rewind *yourself*.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld) || !(user instanceof ServerPlayerEntity player)) {
            return ActionResult.SUCCESS;
        }

        double[] past = Echoes.furthestBack(player);
        if (past == null) {
            user.sendMessage(Text.literal("§7not enough of your past to return to"), true);
            return ActionResult.SUCCESS;
        }

        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                player.getX(), player.getY() + 1.0, player.getZ(), 60, 0.6, 1.0, 0.6, 0.1);

        player.networkHandler.requestTeleport(past[0], past[1], past[2],
                (float) past[3], (float) past[4]);
        // Health as well as position, or a rewind that puts you back on the
        // clifftop still dying of the fall is no rescue at all.
        float was = (float) past[5];
        if (was > player.getHealth()) {
            player.setHealth(Math.min(player.getMaxHealth(), was));
        }

        player.sendMessage(Text.literal("§d⟲ you were somewhere else ten seconds ago"), true);
        serverWorld.playSound(null, player.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 2.0F, 2.0F);
        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                past[0], past[1] + 1.0, past[2], 60, 0.6, 1.0, 0.6, 0.1);

        ItemStack stack = player.getStackInHand(hand);
        player.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
