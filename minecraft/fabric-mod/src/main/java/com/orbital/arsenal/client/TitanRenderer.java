package com.orbital.arsenal.client;

import com.orbital.arsenal.OrbitalArsenal;
import com.orbital.arsenal.entity.TitanEntity;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.MobEntityRenderer;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;
import net.minecraft.util.Identifier;

/**
 * Draws the Titan.
 *
 * Extends MobEntityRenderer rather than drawing outright: the draw call takes
 * a render command queue and a camera state, machinery that belongs to
 * Minecraft and moves with it. Supplying a model and a texture keeps this
 * class to the two things that are actually mine.
 */
public class TitanRenderer
        extends MobEntityRenderer<TitanEntity, LivingEntityRenderState, TitanModel> {

    private static final Identifier TEXTURE =
            Identifier.of(OrbitalArsenal.MOD_ID, "textures/entity/titan.png");

    public TitanRenderer(EntityRendererFactory.Context context) {
        super(context, new TitanModel(context.getPart(OrbitalArsenalClient.TITAN_LAYER)), 2.0F);
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
