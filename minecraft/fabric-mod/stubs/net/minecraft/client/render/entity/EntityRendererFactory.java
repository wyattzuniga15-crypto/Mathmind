package net.minecraft.client.render.entity;

import net.minecraft.client.model.ModelPart;
import net.minecraft.client.render.entity.model.EntityModelLayer;
import net.minecraft.entity.Entity;

@FunctionalInterface
public interface EntityRendererFactory<T extends Entity> {
    EntityRenderer<T, ?> create(Context context);

    class Context { public ModelPart getPart(EntityModelLayer layer) { return null; } }
}
