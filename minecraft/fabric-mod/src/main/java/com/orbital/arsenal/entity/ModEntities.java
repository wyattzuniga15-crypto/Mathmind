package com.orbital.arsenal.entity;

import com.orbital.arsenal.OrbitalArsenal;
import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnGroup;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.util.Identifier;

/** The mod's own entity types. */
public final class ModEntities {
    public static final RegistryKey<EntityType<?>> CHRONARCH_KEY = RegistryKey.of(
            RegistryKeys.ENTITY_TYPE, Identifier.of(OrbitalArsenal.MOD_ID, "chronarch"));

    public static EntityType<ChronarchEntity> CHRONARCH;

    public static final RegistryKey<EntityType<?>> SKY_WHALE_KEY = RegistryKey.of(
            RegistryKeys.ENTITY_TYPE, Identifier.of(OrbitalArsenal.MOD_ID, "sky_whale"));
    public static EntityType<SkyWhaleEntity> SKY_WHALE;

    public static final RegistryKey<EntityType<?>> TITAN_KEY = RegistryKey.of(
            RegistryKeys.ENTITY_TYPE, Identifier.of(OrbitalArsenal.MOD_ID, "titan"));
    public static EntityType<TitanEntity> TITAN;

    public static final RegistryKey<EntityType<?>> DRAGON_KEY = RegistryKey.of(
            RegistryKeys.ENTITY_TYPE, Identifier.of(OrbitalArsenal.MOD_ID, "dragon"));
    public static EntityType<DragonEntity> DRAGON;

    public static final RegistryKey<EntityType<?>> MECHA_SPIDER_KEY = RegistryKey.of(
            RegistryKeys.ENTITY_TYPE, Identifier.of(OrbitalArsenal.MOD_ID, "mecha_spider"));
    public static EntityType<MechaSpiderEntity> MECHA_SPIDER;

    public static final RegistryKey<EntityType<?>> GOLEM_KEY = RegistryKey.of(
            RegistryKeys.ENTITY_TYPE, Identifier.of(OrbitalArsenal.MOD_ID, "golem"));
    public static EntityType<GolemEntity> GOLEM;


    public static final RegistryKey<EntityType<?>> KRAKEN_KEY = RegistryKey.of(
            RegistryKeys.ENTITY_TYPE, Identifier.of(OrbitalArsenal.MOD_ID, "kraken"));
    public static EntityType<KrakenEntity> KRAKEN;

    public static final RegistryKey<EntityType<?>> PHOENIX_KEY = RegistryKey.of(
            RegistryKeys.ENTITY_TYPE, Identifier.of(OrbitalArsenal.MOD_ID, "phoenix"));
    public static EntityType<PhoenixEntity> PHOENIX;


    private ModEntities() {}

    public static void register() {
        CHRONARCH = Registry.register(Registries.ENTITY_TYPE, CHRONARCH_KEY,
                EntityType.Builder.create(ChronarchEntity::new, SpawnGroup.MONSTER)
                        // Wide and tall: it should not fit through a door.
                        .dimensions(2.6F, 3.4F)
                        .build(CHRONARCH_KEY));
        FabricDefaultAttributeRegistry.register(CHRONARCH, ChronarchEntity.createChronarchAttributes());

        SKY_WHALE = Registry.register(Registries.ENTITY_TYPE, SKY_WHALE_KEY,
                EntityType.Builder.create(SkyWhaleEntity::new, SpawnGroup.CREATURE)
                        // Five blocks long and two tall. The hitbox has to
                        // match the model or it is shot at where it is not.
                        .dimensions(5.0F, 2.2F)
                        .build(SKY_WHALE_KEY));
        FabricDefaultAttributeRegistry.register(SKY_WHALE, SkyWhaleEntity.createSkyWhaleAttributes());

        TITAN = Registry.register(Registries.ENTITY_TYPE, TITAN_KEY,
                EntityType.Builder.create(TitanEntity::new, SpawnGroup.MONSTER)
                        .dimensions(2.4F, 7.0F)
                        .build(TITAN_KEY));
        FabricDefaultAttributeRegistry.register(TITAN, TitanEntity.createTitanAttributes());

        DRAGON = Registry.register(Registries.ENTITY_TYPE, DRAGON_KEY,
                EntityType.Builder.create(DragonEntity::new, SpawnGroup.MONSTER)
                        .dimensions(4.0F, 2.6F)
                        .build(DRAGON_KEY));
        FabricDefaultAttributeRegistry.register(DRAGON,
                DragonEntity.createDragonAttributes());

        MECHA_SPIDER = Registry.register(Registries.ENTITY_TYPE, MECHA_SPIDER_KEY,
                EntityType.Builder.create(MechaSpiderEntity::new, SpawnGroup.MONSTER)
                        .dimensions(3.2F, 2.0F)
                        .build(MECHA_SPIDER_KEY));
        FabricDefaultAttributeRegistry.register(MECHA_SPIDER,
                MechaSpiderEntity.createMechaSpiderAttributes());

        GOLEM = Registry.register(Registries.ENTITY_TYPE, GOLEM_KEY,
                EntityType.Builder.create(GolemEntity::new, SpawnGroup.MONSTER)
                        .dimensions(2.2F, 3.6F)
                        .build(GOLEM_KEY));
        FabricDefaultAttributeRegistry.register(GOLEM,
                GolemEntity.createGolemAttributes());

        KRAKEN = Registry.register(Registries.ENTITY_TYPE, KRAKEN_KEY,
                EntityType.Builder.create(KrakenEntity::new, SpawnGroup.MONSTER)
                        // Wide for the arms, which reach past the body the
                        // hitbox describes; four and a bit tall, which is
                        // exactly what the model measures from mantle to the
                        // tips of the arms.
                        .dimensions(2.8F, 4.4F)
                        .build(KRAKEN_KEY));
        FabricDefaultAttributeRegistry.register(KRAKEN, KrakenEntity.createKrakenAttributes());

        PHOENIX = Registry.register(Registries.ENTITY_TYPE, PHOENIX_KEY,
                EntityType.Builder.create(PhoenixEntity::new, SpawnGroup.MONSTER)
                        // The wingspan is three blocks; the hitbox is the body,
                        // because a hitbox the size of the wings is unhittable
                        // nonsense to fight.
                        .dimensions(1.4F, 1.6F)
                        .build(PHOENIX_KEY));
        FabricDefaultAttributeRegistry.register(PHOENIX,
                PhoenixEntity.createPhoenixAttributes());

    }
}
