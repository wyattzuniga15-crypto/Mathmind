package com.orbital.arsenal.client;

import com.orbital.arsenal.OrbitalArsenal;
import com.orbital.arsenal.entity.ChronarchEntity;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.MobEntityRenderer;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;
import net.minecraft.util.Identifier;

/**
 * Draws the Chronarch.
 *
 * Extending MobEntityRenderer rather than implementing rendering outright is
 * deliberate: the draw call in this version takes a render command queue and a
 * camera state, machinery that belongs to Minecraft and moves with it. Supplying
 * a model and a texture and letting the vanilla renderer do the drawing keeps
 * this class to the two things that are actually mine.
 */
public class ChronarchRenderer
        extends MobEntityRenderer<ChronarchEntity, LivingEntityRenderState, ChronarchModel> {

    private static final Identifier TEXTURE =
            Identifier.of(OrbitalArsenal.MOD_ID, "textures/entity/chronarch.png");

    public ChronarchRenderer(EntityRendererFactory.Context context) {
        super(context, new ChronarchModel(context.getPart(OrbitalArsenalClient.CHRONARCH_LAYER)), 1.2F);
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
