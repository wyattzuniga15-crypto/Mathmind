package net.fabricmc.fabric.api.client.rendering.v1;

import net.minecraft.client.model.TexturedModelData;
import net.minecraft.client.render.entity.model.EntityModelLayer;

public final class EntityModelLayerRegistry {
    public interface TexturedModelDataProvider { TexturedModelData createModelData(); }
    public static void registerModelLayer(EntityModelLayer layer, TexturedModelDataProvider provider) {}
}
