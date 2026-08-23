package com.orbital.arsenal.items;

import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.time.Souls;
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
 * It restores blocks, where mobs were standing, and mobs that died — the
 * three things these weapons take away.
 *
 * Resurrection has one honest limit worth knowing before you rely on it: a mob
 * comes back as the same kind of creature in the same place, keeping its name,
 * but it is a new animal. A tamed wolf comes back wild, a villager comes back
 * without its trades, and nothing comes back holding what it was carrying.
 * Restoring those needs a mob's full saved state, and the calls for that were
 * reworked in recent versions to something I could not verify from here — so
 * this does the part that can be done correctly rather than the part that
 * might silently do nothing.
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
        int[] living = Souls.rewind(serverWorld);
        if (restored == 0 && living[0] == 0 && living[1] == 0) {
            user.sendMessage(Text.literal("§7⟲ nothing to undo"), true);
            return ActionResult.SUCCESS;
        }

        StringBuilder report = new StringBuilder("§b⟲ REWIND — " + restored + " blocks");
        if (living[0] > 0) {
            report.append(", ").append(living[0]).append(" moved back");
        }
        if (living[1] > 0) {
            report.append(", §a").append(living[1]).append(" revived");
        }
        user.sendMessage(Text.literal(report.toString()), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 3.0F, 2.0F);
        Vec3d at = new Vec3d(user.getX(), user.getY() + 1.0, user.getZ());
        serverWorld.spawnParticles(ParticleTypes.END_ROD, at.x, at.y, at.z, 60, 1.5, 1.5, 1.5, 0.08);

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
