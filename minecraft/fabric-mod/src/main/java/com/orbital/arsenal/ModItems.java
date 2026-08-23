package com.orbital.arsenal;

import com.orbital.arsenal.items.BlackHoleItem;
import com.orbital.arsenal.items.KamehamehaItem;
import com.orbital.arsenal.items.OrbitalLaserItem;
import com.orbital.arsenal.items.PotatoBombItem;
import com.orbital.arsenal.items.RewindClockItem;
import com.orbital.arsenal.items.StrikeCannonItem;
import com.orbital.arsenal.items.TacticalNukeItem;
import java.util.function.Function;
import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.minecraft.item.Item;
import net.minecraft.item.ItemGroups;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.util.Identifier;

public final class ModItems {
    public static Item STRIKE_CANNON;
    public static Item TACTICAL_NUKE;
    public static Item KAMEHAMEHA;
    public static Item BLACK_HOLE;
    public static Item ORBITAL_LASER;
    public static Item POTATO_BOMB;
    public static Item REWIND_CLOCK;

    private ModItems() {}

    /**
     * Since 1.21.2 an Item has to be built already knowing its own registry
     * key, so the identifier is made first and handed to the settings before
     * anything is registered.
     */
    private static Item register(String name, Function<Item.Settings, Item> factory) {
        Identifier id = Identifier.of(OrbitalArsenal.MOD_ID, name);
        RegistryKey<Item> key = RegistryKey.of(RegistryKeys.ITEM, id);
        Item item = factory.apply(new Item.Settings().registryKey(key).maxCount(1));
        return Registry.register(Registries.ITEM, key, item);
    }

    public static void register() {
        STRIKE_CANNON = register("strike_cannon", StrikeCannonItem::new);
        TACTICAL_NUKE = register("tactical_nuke", TacticalNukeItem::new);
        KAMEHAMEHA = register("kamehameha", KamehamehaItem::new);
        BLACK_HOLE = register("black_hole", BlackHoleItem::new);
        ORBITAL_LASER = register("orbital_laser", OrbitalLaserItem::new);
        POTATO_BOMB = register("potato_bomb", PotatoBombItem::new);
        REWIND_CLOCK = register("rewind_clock", RewindClockItem::new);

        ItemGroupEvents.modifyEntriesEvent(ItemGroups.COMBAT).register(entries -> {
            entries.add(STRIKE_CANNON);
            entries.add(TACTICAL_NUKE);
            entries.add(KAMEHAMEHA);
            entries.add(BLACK_HOLE);
            entries.add(ORBITAL_LASER);
            entries.add(POTATO_BOMB);
            entries.add(REWIND_CLOCK);
        });
    }
}
