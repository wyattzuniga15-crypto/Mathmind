package com.orbital.arsenal;

import com.orbital.arsenal.items.CatBazookaItem;
import com.orbital.arsenal.items.DisintegratorItem;
import com.orbital.arsenal.items.BlackHoleGrenadeItem;
import com.orbital.arsenal.items.NapalmLauncherItem;
import com.orbital.arsenal.items.EarthquakeHammerItem;
import com.orbital.arsenal.items.SwarmMissilesItem;
import com.orbital.arsenal.items.ShotgunBlastItem;
import com.orbital.arsenal.items.AcidSprayItem;
import com.orbital.arsenal.items.SonicCannonItem;
import com.orbital.arsenal.items.ChainLightningItem;
import com.orbital.arsenal.items.IceSpikesItem;
import com.orbital.arsenal.items.LandmineItem;
import com.orbital.arsenal.items.NukeSuitcaseItem;
import com.orbital.arsenal.items.GiantChickenItem;
import com.orbital.arsenal.items.GiantBootItem;
import com.orbital.arsenal.items.GiantHammerItem;
import com.orbital.arsenal.items.GiantSkullItem;
import com.orbital.arsenal.items.GiantMushroomItem;
import com.orbital.arsenal.items.GiantSwordItem;
import com.orbital.arsenal.items.GiantBellItem;
import com.orbital.arsenal.items.GiantTrophyItem;
import com.orbital.arsenal.items.GiantDiceItem;
import com.orbital.arsenal.items.GiantDonutItem;
import com.orbital.arsenal.items.GiantRocketItem;
import com.orbital.arsenal.items.GiantTeapotItem;
import com.orbital.arsenal.items.VolcanoSeedItem;
import com.orbital.arsenal.items.GravityFlipItem;
import com.orbital.arsenal.items.SkyIslandItem;
import com.orbital.arsenal.items.TerraformerItem;
import com.orbital.arsenal.items.LakeMakerItem;
import com.orbital.arsenal.items.GravityGunItem;
import com.orbital.arsenal.items.GrapplingHookItem;
import com.orbital.arsenal.items.ShrinkRayItem;
import com.orbital.arsenal.items.DoppelgangerItem;
import com.orbital.arsenal.items.JetpackItem;
import com.orbital.arsenal.items.RailgunItem;
import com.orbital.arsenal.items.TornadoItem;
import com.orbital.arsenal.items.FreezeRayItem;
import com.orbital.arsenal.items.MeteorStormItem;
import com.orbital.arsenal.items.LightningCallerItem;
import com.orbital.arsenal.items.GiantDuckItem;
import com.orbital.arsenal.items.GiantAnvilItem;
import com.orbital.arsenal.items.GrandPianoItem;
import com.orbital.arsenal.items.GiantDiamondItem;
import com.orbital.arsenal.items.GiantCakeItem;
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
    public static Item GIANT_DUCK;
    public static Item GIANT_ANVIL;
    public static Item GRAND_PIANO;
    public static Item GIANT_DIAMOND;
    public static Item GIANT_CAKE;
    public static Item RAILGUN;
    public static Item TORNADO_JAR;
    public static Item FREEZE_RAY;
    public static Item METEOR_STORM;
    public static Item LIGHTNING_CALLER;
    public static Item GRAVITY_GUN;
    public static Item GRAPPLING_HOOK;
    public static Item SHRINK_RAY;
    public static Item DOPPELGANGER;
    public static Item JETPACK;
    public static Item VOLCANO_SEED;
    public static Item GRAVITY_FLIP;
    public static Item SKY_ISLAND;
    public static Item TERRAFORMER;
    public static Item LAKE_MAKER;
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
    public static Item GIANT_CHICKEN;
    public static Item GIANT_BOOT;
    public static Item GIANT_HAMMER;
    public static Item GIANT_SKULL;
    public static Item GIANT_MUSHROOM;
    public static Item GIANT_SWORD;
    public static Item GIANT_BELL;
    public static Item GIANT_TROPHY;
    public static Item GIANT_DICE;
    public static Item GIANT_DONUT;
    public static Item GIANT_ROCKET;
    public static Item GIANT_TEAPOT;
    public static Item DISINTEGRATOR;
    public static Item BLACK_HOLE_GRENADE;
    public static Item NAPALM_LAUNCHER;
    public static Item EARTHQUAKE_HAMMER;
    public static Item SWARM_MISSILES;
    public static Item SHOTGUN_BLAST;
    public static Item ACID_SPRAY;
    public static Item SONIC_CANNON;
    public static Item CHAIN_LIGHTNING;
    public static Item ICE_SPIKES;
    public static Item LANDMINE;
    public static Item NUKE_SUITCASE;

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
        GIANT_DUCK = register("giant_duck", GiantDuckItem::new);
        GIANT_ANVIL = register("giant_anvil", GiantAnvilItem::new);
        GRAND_PIANO = register("grand_piano", GrandPianoItem::new);
        GIANT_DIAMOND = register("giant_diamond", GiantDiamondItem::new);
        GIANT_CAKE = register("giant_cake", GiantCakeItem::new);
        RAILGUN = register("railgun", RailgunItem::new);
        TORNADO_JAR = register("tornado_jar", TornadoItem::new);
        FREEZE_RAY = register("freeze_ray", FreezeRayItem::new);
        METEOR_STORM = register("meteor_storm", MeteorStormItem::new);
        LIGHTNING_CALLER = register("lightning_caller", LightningCallerItem::new);
        GRAVITY_GUN = register("gravity_gun", GravityGunItem::new);
        GRAPPLING_HOOK = register("grappling_hook", GrapplingHookItem::new);
        SHRINK_RAY = register("shrink_ray", ShrinkRayItem::new);
        DOPPELGANGER = register("doppelganger", DoppelgangerItem::new);
        JETPACK = register("jetpack", JetpackItem::new);
        VOLCANO_SEED = register("volcano_seed", VolcanoSeedItem::new);
        GRAVITY_FLIP = register("gravity_flip", GravityFlipItem::new);
        SKY_ISLAND = register("sky_island", SkyIslandItem::new);
        TERRAFORMER = register("terraformer", TerraformerItem::new);
        LAKE_MAKER = register("lake_maker", LakeMakerItem::new);
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
        GIANT_CHICKEN = register("giant_chicken", GiantChickenItem::new);
        GIANT_BOOT = register("giant_boot", GiantBootItem::new);
        GIANT_HAMMER = register("giant_hammer", GiantHammerItem::new);
        GIANT_SKULL = register("giant_skull", GiantSkullItem::new);
        GIANT_MUSHROOM = register("giant_mushroom", GiantMushroomItem::new);
        GIANT_SWORD = register("giant_sword", GiantSwordItem::new);
        GIANT_BELL = register("giant_bell", GiantBellItem::new);
        GIANT_TROPHY = register("giant_trophy", GiantTrophyItem::new);
        GIANT_DICE = register("giant_dice", GiantDiceItem::new);
        GIANT_DONUT = register("giant_donut", GiantDonutItem::new);
        GIANT_ROCKET = register("giant_rocket", GiantRocketItem::new);
        GIANT_TEAPOT = register("giant_teapot", GiantTeapotItem::new);

        DISINTEGRATOR = register("disintegrator", DisintegratorItem::new);
        BLACK_HOLE_GRENADE = register("black_hole_grenade", BlackHoleGrenadeItem::new);
        NAPALM_LAUNCHER = register("napalm_launcher", NapalmLauncherItem::new);
        EARTHQUAKE_HAMMER = register("earthquake_hammer", EarthquakeHammerItem::new);
        SWARM_MISSILES = register("swarm_missiles", SwarmMissilesItem::new);
        SHOTGUN_BLAST = register("shotgun_blast", ShotgunBlastItem::new);
        ACID_SPRAY = register("acid_spray", AcidSprayItem::new);
        SONIC_CANNON = register("sonic_cannon", SonicCannonItem::new);
        CHAIN_LIGHTNING = register("chain_lightning", ChainLightningItem::new);
        ICE_SPIKES = register("ice_spikes", IceSpikesItem::new);
        LANDMINE = register("landmine", LandmineItem::new);
        NUKE_SUITCASE = register("nuke_suitcase", NukeSuitcaseItem::new);
        ItemGroupEvents.modifyEntriesEvent(ItemGroups.COMBAT).register(entries -> {
            entries.add(STRIKE_CANNON);
            entries.add(TACTICAL_NUKE);
            entries.add(KAMEHAMEHA);
            entries.add(BLACK_HOLE);
            entries.add(ORBITAL_LASER);
            entries.add(POTATO_BOMB);
            entries.add(CAT_BAZOOKA);
            entries.add(GROWING_CAT);
            entries.add(GIANT_DUCK);
            entries.add(GIANT_ANVIL);
            entries.add(GRAND_PIANO);
            entries.add(GIANT_DIAMOND);
            entries.add(GIANT_CAKE);
            entries.add(RAILGUN);
            entries.add(TORNADO_JAR);
            entries.add(FREEZE_RAY);
            entries.add(METEOR_STORM);
            entries.add(LIGHTNING_CALLER);
            entries.add(GRAVITY_GUN);
            entries.add(GRAPPLING_HOOK);
            entries.add(SHRINK_RAY);
            entries.add(DOPPELGANGER);
            entries.add(JETPACK);
            entries.add(VOLCANO_SEED);
            entries.add(GRAVITY_FLIP);
            entries.add(SKY_ISLAND);
            entries.add(TERRAFORMER);
            entries.add(LAKE_MAKER);
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
            entries.add(GIANT_CHICKEN);
            entries.add(GIANT_BOOT);
            entries.add(GIANT_HAMMER);
            entries.add(GIANT_SKULL);
            entries.add(GIANT_MUSHROOM);
            entries.add(GIANT_SWORD);
            entries.add(GIANT_BELL);
            entries.add(GIANT_TROPHY);
            entries.add(GIANT_DICE);
            entries.add(GIANT_DONUT);
            entries.add(GIANT_ROCKET);
            entries.add(GIANT_TEAPOT);
            entries.add(DISINTEGRATOR);
            entries.add(BLACK_HOLE_GRENADE);
            entries.add(NAPALM_LAUNCHER);
            entries.add(EARTHQUAKE_HAMMER);
            entries.add(SWARM_MISSILES);
            entries.add(SHOTGUN_BLAST);
            entries.add(ACID_SPRAY);
            entries.add(SONIC_CANNON);
            entries.add(CHAIN_LIGHTNING);
            entries.add(ICE_SPIKES);
            entries.add(LANDMINE);
            entries.add(NUKE_SUITCASE);
        });
        return registered;
    }
}
