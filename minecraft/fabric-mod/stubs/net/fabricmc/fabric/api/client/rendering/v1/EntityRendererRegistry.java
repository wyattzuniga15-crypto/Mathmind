package net.fabricmc.fabric.api.client.rendering.v1;

import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;

public final class EntityRendererRegistry {
    public static <T extends Entity> void register(EntityType<? extends T> type,
                                                   EntityRendererFactory<T> factory) {}
}
