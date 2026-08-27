package com.orbital.arsenal.client;

import com.orbital.arsenal.OrbitalArsenal;
import com.orbital.arsenal.entity.ModEntities;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.rendering.v1.EntityModelLayerRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry;
import net.minecraft.client.render.entity.model.EntityModelLayer;
import net.minecraft.util.Identifier;

/**
 * The mod's client half — the first it has needed.
 *
 * Everything else here is server-side and runs on an unmodified client. A mob
 * with a model of its own cannot be: something has to tell the client what
 * shape to draw, and that is this.
 */
public class OrbitalArsenalClient implements ClientModInitializer {
    public static final EntityModelLayer CHRONARCH_LAYER = new EntityModelLayer(
            Identifier.of(OrbitalArsenal.MOD_ID, "chronarch"), "main");
    public static final EntityModelLayer SKY_WHALE_LAYER = new EntityModelLayer(
            Identifier.of(OrbitalArsenal.MOD_ID, "sky_whale"), "main");
    public static final EntityModelLayer TITAN_LAYER = new EntityModelLayer(
            Identifier.of(OrbitalArsenal.MOD_ID, "titan"), "main");

    @Override
    public void onInitializeClient() {
        EntityModelLayerRegistry.registerModelLayer(CHRONARCH_LAYER, ChronarchModel::getTexturedModelData);
        EntityRendererRegistry.register(ModEntities.CHRONARCH, ChronarchRenderer::new);

        EntityModelLayerRegistry.registerModelLayer(SKY_WHALE_LAYER, SkyWhaleModel::getTexturedModelData);
        EntityRendererRegistry.register(ModEntities.SKY_WHALE, SkyWhaleRenderer::new);

        EntityModelLayerRegistry.registerModelLayer(TITAN_LAYER, TitanModel::getTexturedModelData);
        EntityRendererRegistry.register(ModEntities.TITAN, TitanRenderer::new);
    }
}
