package com.orbital.arsenal.companion;

import com.orbital.arsenal.ModItems;
import net.minecraft.item.Item;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.Hand;

/** Lets the companion pull the trigger on the arsenal the player already owns. */
final class Weapons {
    private Weapons() {}

    /**
     * Fire a weapon as though the player had right-clicked it.
     *
     * Every weapon already aims at what the player is looking at and spreads
     * its work across ticks, so firing one is exactly its use() — no separate
     * path to keep in step with the items themselves.
     *
     * @return the weapon's readable name, or null if there is no such weapon
     */
    static String fire(String name, ServerPlayerEntity player) {
        Item item;
        String label;
        switch (name) {
            case "strike_cannon", "cannon", "orbital_strike_cannon" -> {
                item = ModItems.STRIKE_CANNON;
                label = "Orbital Strike Cannon";
            }
            case "tactical_nuke", "nuke" -> {
                item = ModItems.TACTICAL_NUKE;
                label = "Tactical Nuke";
            }
            case "kamehameha", "beam" -> {
                item = ModItems.KAMEHAMEHA;
                label = "Kamehameha";
            }
            case "black_hole", "blackhole" -> {
                item = ModItems.BLACK_HOLE;
                label = "Black Hole";
            }
            case "orbital_laser", "laser" -> {
                item = ModItems.ORBITAL_LASER;
                label = "Orbital Laser";
            }
            default -> {
                return null;
            }
        }
        if (item == null) {
            return null;
        }
        item.use(player.getEntityWorld(), player, Hand.MAIN_HAND);
        return label;
    }
}
