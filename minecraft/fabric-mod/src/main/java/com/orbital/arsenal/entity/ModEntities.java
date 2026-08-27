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
    }
}
