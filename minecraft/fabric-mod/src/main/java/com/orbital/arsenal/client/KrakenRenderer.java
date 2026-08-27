package com.orbital.arsenal.client;

import com.orbital.arsenal.OrbitalArsenal;
import com.orbital.arsenal.entity.KrakenEntity;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.MobEntityRenderer;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;
import net.minecraft.util.Identifier;

/** Draws the Kraken. Model and texture only; the draw call is Minecraft's. */
public class KrakenRenderer
        extends MobEntityRenderer<KrakenEntity, LivingEntityRenderState, KrakenModel> {

    private static final Identifier TEXTURE =
            Identifier.of(OrbitalArsenal.MOD_ID, "textures/entity/kraken.png");

    public KrakenRenderer(EntityRendererFactory.Context context) {
        super(context, new KrakenModel(context.getPart(OrbitalArsenalClient.KRAKEN_LAYER)), 1.4F);
    }

    @Override
    public LivingEntityRenderState createRenderState() {
        return new LivingEntityRenderState();
    }

    @Override
    public Identifier getTexture(LivingEntityRenderState state) {
        return TEXTURE;
    }
}
