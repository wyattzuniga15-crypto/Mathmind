package net.fabricmc.fabric.api.object.builder.v1.entity;

import net.minecraft.entity.EntityType;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.attribute.DefaultAttributeContainer;

public final class FabricDefaultAttributeRegistry {
    public static void register(EntityType<? extends LivingEntity> type,
                                DefaultAttributeContainer.Builder builder) {}
}
