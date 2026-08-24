package com.orbital.arsenal;

import com.orbital.arsenal.items.BlackHoleItem;
import com.orbital.arsenal.items.KamehamehaItem;
import com.orbital.arsenal.items.OrbitalLaserItem;
import com.orbital.arsenal.items.EchoBeaconItem;
import com.orbital.arsenal.items.EchoGhostItem;
import com.orbital.arsenal.items.PotatoBombItem;
import com.orbital.arsenal.items.SlowTimeClockItem;
import com.orbital.arsenal.items.TimeStopClockItem;
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
    public static Item TIME_STOP_CLOCK;
    public static Item SLOW_TIME_CLOCK;
    public static Item ECHO_GHOST;
    public static Item ECHO_BEACON;
    public static Item REWIND_CLOCK;

    /**
     * Counted as they go in rather than written down. A hardcoded total drifts
     * the first time an item is added and then lies in the startup log, which
     * is the one place it needs to be trustworthy.
     */
    private static int registered = 0;

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
        registered++;
        return Registry.register(Registries.ITEM, key, item);
    }

    public static int register() {
        STRIKE_CANNON = register("strike_cannon", StrikeCannonItem::new);
        TACTICAL_NUKE = register("tactical_nuke", TacticalNukeItem::new);
        KAMEHAMEHA = register("kamehameha", KamehamehaItem::new);
        BLACK_HOLE = register("black_hole", BlackHoleItem::new);
        ORBITAL_LASER = register("orbital_laser", OrbitalLaserItem::new);
        POTATO_BOMB = register("potato_bomb", PotatoBombItem::new);
        TIME_STOP_CLOCK = register("time_stop_clock", TimeStopClockItem::new);
        SLOW_TIME_CLOCK = register("slow_time_clock", SlowTimeClockItem::new);
        ECHO_GHOST = register("echo_ghost", EchoGhostItem::new);
        ECHO_BEACON = register("echo_beacon", EchoBeaconItem::new);
        REWIND_CLOCK = register("rewind_clock", RewindClockItem::new);

        ItemGroupEvents.modifyEntriesEvent(ItemGroups.COMBAT).register(entries -> {
            entries.add(STRIKE_CANNON);
            entries.add(TACTICAL_NUKE);
            entries.add(KAMEHAMEHA);
            entries.add(BLACK_HOLE);
            entries.add(ORBITAL_LASER);
            entries.add(POTATO_BOMB);
            entries.add(TIME_STOP_CLOCK);
            entries.add(SLOW_TIME_CLOCK);
            entries.add(ECHO_GHOST);
            entries.add(ECHO_BEACON);
            entries.add(REWIND_CLOCK);
        });
        return registered;
    }
}
