package com.orbital.arsenal.items;

import com.orbital.arsenal.time.Journal;
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
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * Puts the last thirty seconds back.
 *
 * The only thing here that builds rather than destroys, and the only answer to
 * the rest of the arsenal — fire the black hole into your own base and this is
 * what gets it back.
 *
 * What it restores is blocks. Mobs killed in the blast stay dead and items
 * dropped stay dropped: recording every entity's full state every tick costs
 * far more than recording block changes does, and blocks are what these
 * weapons actually take away.
 */
public class RewindClockItem extends Item {
    private static final int COOLDOWN = 200;

    public RewindClockItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        int restored = Journal.rewind(serverWorld);
        if (restored == 0) {
            user.sendMessage(Text.literal("§7⟲ nothing to undo"), true);
            return ActionResult.SUCCESS;
        }

        user.sendMessage(Text.literal("§b⟲ REWIND — " + restored + " blocks put back"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 3.0F, 2.0F);
        Vec3d at = new Vec3d(user.getX(), user.getY() + 1.0, user.getZ());
        serverWorld.spawnParticles(ParticleTypes.END_ROD, at.x, at.y, at.z, 60, 1.5, 1.5, 1.5, 0.08);

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
