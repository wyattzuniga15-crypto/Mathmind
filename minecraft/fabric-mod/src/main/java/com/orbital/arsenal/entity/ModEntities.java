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

    private ModEntities() {}

    public static void register() {
        CHRONARCH = Registry.register(Registries.ENTITY_TYPE, CHRONARCH_KEY,
                EntityType.Builder.create(ChronarchEntity::new, SpawnGroup.MONSTER)
                        // Wide and tall: it should not fit through a door.
                        .dimensions(2.6F, 3.4F)
                        .build(CHRONARCH_KEY));
        FabricDefaultAttributeRegistry.register(CHRONARCH, ChronarchEntity.createChronarchAttributes());
    }
}
