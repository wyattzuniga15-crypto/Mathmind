package com.orbital.arsenal.client;

import com.orbital.arsenal.OrbitalArsenal;
import com.orbital.arsenal.entity.SkyWhaleEntity;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.MobEntityRenderer;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;
import net.minecraft.util.Identifier;

/**
 * Draws the Sky Whale.
 *
 * Extends MobEntityRenderer rather than drawing outright: the draw call takes
 * a render command queue and a camera state, machinery that belongs to
 * Minecraft and moves with it. Supplying a model and a texture keeps this
 * class to the two things that are actually mine.
 */
public class SkyWhaleRenderer
        extends MobEntityRenderer<SkyWhaleEntity, LivingEntityRenderState, SkyWhaleModel> {

    private static final Identifier TEXTURE =
            Identifier.of(OrbitalArsenal.MOD_ID, "textures/entity/sky_whale.png");

    public SkyWhaleRenderer(EntityRendererFactory.Context context) {
        super(context, new SkyWhaleModel(context.getPart(OrbitalArsenalClient.SKY_WHALE_LAYER)), 2.4F);
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
