package com.orbital.arsenal;

import com.orbital.arsenal.items.CatBazookaItem;
import com.orbital.arsenal.items.GrowingCatItem;
import com.orbital.arsenal.items.BlackHoleItem;
import com.orbital.arsenal.items.KamehamehaItem;
import com.orbital.arsenal.items.OrbitalLaserItem;
import com.orbital.arsenal.items.BottledChunkItem;
import com.orbital.arsenal.items.ChronarchHeartItem;
import com.orbital.arsenal.items.ChronarchSealItem;
import com.orbital.arsenal.items.EchoBeaconItem;
import com.orbital.arsenal.items.EchoGhostItem;
import com.orbital.arsenal.items.FastForwardClockItem;
import com.orbital.arsenal.items.OreSenseItem;
import com.orbital.arsenal.items.PortalGunItem;
import com.orbital.arsenal.items.PotatoBombItem;
import com.orbital.arsenal.items.SlowTimeClockItem;
import com.orbital.arsenal.items.TimeStopClockItem;
import com.orbital.arsenal.items.RewindClockItem;
import com.orbital.arsenal.time.Journal;
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
    public static Item CAT_BAZOOKA;
    public static Item GROWING_CAT;
    public static Item TIME_STOP_CLOCK;
    public static Item SLOW_TIME_CLOCK;
    public static Item ECHO_GHOST;
    public static Item ECHO_BEACON;
    public static Item FAST_FORWARD_CLOCK;
    public static Item ORE_SENSE;
    public static Item BOTTLED_CHUNK;
    public static Item PORTAL_GUN;
    public static Item CHRONARCH_SEAL;
    public static Item CHRONARCH_HEART;
    public static Item REWIND_CLOCK;
    public static Item DEEP_REWIND_CLOCK;
    public static Item LONG_REWIND_CLOCK;
    public static Item GENESIS_CLOCK;

    /**
     * Counted as they go in rather than written down. A hardcoded total drifts
     * the first time an item is added and then lies in the startup log, which
     * is the one place it needs to be trustworthy.
     */
    /** Every clock waits the same five seconds. */
    public static final int CLOCK_COOLDOWN = 100;

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
        CAT_BAZOOKA = register("cat_bazooka", CatBazookaItem::new);
        GROWING_CAT = register("growing_cat", GrowingCatItem::new);
        TIME_STOP_CLOCK = register("time_stop_clock", TimeStopClockItem::new);
        SLOW_TIME_CLOCK = register("slow_time_clock", SlowTimeClockItem::new);
        ECHO_GHOST = register("echo_ghost", EchoGhostItem::new);
        ECHO_BEACON = register("echo_beacon", EchoBeaconItem::new);
        FAST_FORWARD_CLOCK = register("fast_forward_clock", FastForwardClockItem::new);
        ORE_SENSE = register("ore_sense", OreSenseItem::new);
        BOTTLED_CHUNK = register("bottled_chunk", BottledChunkItem::new);
        PORTAL_GUN = register("portal_gun", PortalGunItem::new);
        CHRONARCH_SEAL = register("chronarch_seal", ChronarchSealItem::new);
        CHRONARCH_HEART = register("chronarch_heart", ChronarchHeartItem::new);
        // Five seconds each, however far they reach — asked for outright.
        // The deeper ones are no longer rationed by their cooldown, so the
        // record's own limits are all that hold them back now.
        REWIND_CLOCK = register("rewind_clock",
                settings -> new RewindClockItem(settings, Journal.ONE_MINUTE, "1 minute", CLOCK_COOLDOWN));
        DEEP_REWIND_CLOCK = register("deep_rewind_clock",
                settings -> new RewindClockItem(settings, Journal.FIVE_MINUTES, "5 minutes", CLOCK_COOLDOWN));
        LONG_REWIND_CLOCK = register("long_rewind_clock",
                settings -> new RewindClockItem(settings, Journal.TEN_MINUTES, "10 minutes", CLOCK_COOLDOWN));
        GENESIS_CLOCK = register("genesis_clock",
                settings -> new RewindClockItem(settings, Journal.EVERYTHING, "everything", CLOCK_COOLDOWN));

        ItemGroupEvents.modifyEntriesEvent(ItemGroups.COMBAT).register(entries -> {
            entries.add(STRIKE_CANNON);
            entries.add(TACTICAL_NUKE);
            entries.add(KAMEHAMEHA);
            entries.add(BLACK_HOLE);
            entries.add(ORBITAL_LASER);
            entries.add(POTATO_BOMB);
            entries.add(CAT_BAZOOKA);
            entries.add(GROWING_CAT);
            entries.add(TIME_STOP_CLOCK);
            entries.add(SLOW_TIME_CLOCK);
            entries.add(ECHO_GHOST);
            entries.add(ECHO_BEACON);
            entries.add(FAST_FORWARD_CLOCK);
            entries.add(ORE_SENSE);
            entries.add(BOTTLED_CHUNK);
            entries.add(PORTAL_GUN);
            entries.add(CHRONARCH_SEAL);
            entries.add(CHRONARCH_HEART);
            entries.add(REWIND_CLOCK);
            entries.add(DEEP_REWIND_CLOCK);
            entries.add(LONG_REWIND_CLOCK);
            entries.add(GENESIS_CLOCK);
        });
        return registered;
    }
}
