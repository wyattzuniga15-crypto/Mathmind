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

    }
}
