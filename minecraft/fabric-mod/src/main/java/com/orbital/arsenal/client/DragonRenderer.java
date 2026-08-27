package com.orbital.arsenal.client;

import com.orbital.arsenal.OrbitalArsenal;
import com.orbital.arsenal.entity.DragonEntity;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.MobEntityRenderer;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;
import net.minecraft.util.Identifier;

/**
 * Draws the Dragon.
 *
 * Extends MobEntityRenderer rather than drawing outright: the draw call takes
 * a render command queue and a camera state, machinery that belongs to
 * Minecraft and moves with it. Supplying a model and a texture keeps this
 * class to the two things that are actually mine.
 */
public class DragonRenderer
        extends MobEntityRenderer<DragonEntity, LivingEntityRenderState, DragonModel> {

    private static final Identifier TEXTURE =
            Identifier.of(OrbitalArsenal.MOD_ID, "textures/entity/dragon.png");

    public DragonRenderer(EntityRendererFactory.Context context) {
        super(context, new DragonModel(context.getPart(OrbitalArsenalClient.DRAGON_LAYER)), 1.8F);
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
