package com.orbital.arsenal.items;

import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.time.Souls;
import net.minecraft.entity.player.PlayerEntity;
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
 * The clocks that put the world back — one class, four reaches.
 *
 * A minute, five, ten, and everything still recorded. They differ only in how
 * far they look and what they cost to use, so four near-identical classes would
 * be four places to fix the same bug. The reach is handed in at registration.
 *
 * All four read the same record. A shallow rewind takes only the frames inside
 * its own window and leaves the rest, so undoing the last minute does not spend
 * the previous nine — a deeper clock can still reach them afterwards.
 *
 * They restore blocks, where mobs were standing, and mobs that died. They do
 * not restore a mob's inventory, its taming or a villager's trades: those need
 * a mob's full saved state, and the calls for it were reworked in recent
 * versions into something I could not verify. A revived mob is the same
 * creature in the same place with the same name, but it is a new animal.
 */
public class RewindClockItem extends ArsenalItem {
    private final int reach;
    private final String label;
    private final int cooldown;

    /**
     * @param reach how far back to undo, in ticks
     * @param label how to name that reach in chat
     * @param cooldown ticks before it can be used again — deeper clocks wait longer
     */
    /** What this particular clock does, from the window it was built with. */
    private static String describe(String label) {
        if ("everything".equals(label)) {
            return "Puts the world back to the beginning — the whole recording, undone.";
        }
        return "Puts the world back " + label + ", every block of it.";
    }

    public RewindClockItem(Settings settings, int reach, String label, int cooldown) {
        // Four items share this class, so the class comment describes all four
        // and would be no use on any of them. Each clock says its own reach.
        super(settings, describe(label));
        this.reach = reach;
        this.label = label;
        this.cooldown = cooldown;
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        int restored = Journal.rewind(serverWorld, reach);
        int[] living = Souls.rewind(serverWorld, reach);
        if (restored == 0 && living[0] == 0 && living[1] == 0) {
            user.sendMessage(Text.literal("§7⟲ nothing in the last " + label + " to undo"), true);
            return ActionResult.SUCCESS;
        }

        StringBuilder report = new StringBuilder("§b⟲ REWIND " + label + " — " + restored + " blocks");
        if (living[0] > 0) {
            report.append(", ").append(living[0]).append(" moved back");
        }
        if (living[1] > 0) {
            report.append(", §a").append(living[1]).append(" revived");
        }
        user.sendMessage(Text.literal(report.toString()), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 3.0F, 2.0F);
        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                user.getX(), user.getY() + 1.0, user.getZ(), 60, 1.5, 1.5, 1.5, 0.08);

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, cooldown);
        return ActionResult.SUCCESS;
    }
}
