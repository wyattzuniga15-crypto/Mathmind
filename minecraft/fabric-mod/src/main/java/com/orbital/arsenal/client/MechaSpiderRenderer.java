package com.orbital.arsenal.client;

import com.orbital.arsenal.OrbitalArsenal;
import com.orbital.arsenal.entity.MechaSpiderEntity;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.MobEntityRenderer;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;
import net.minecraft.util.Identifier;

/**
 * Draws the MechaSpider.
 *
 * Extends MobEntityRenderer rather than drawing outright: the draw call takes
 * a render command queue and a camera state, machinery that belongs to
 * Minecraft and moves with it. Supplying a model and a texture keeps this
 * class to the two things that are actually mine.
 */
public class MechaSpiderRenderer
        extends MobEntityRenderer<MechaSpiderEntity, LivingEntityRenderState, MechaSpiderModel> {

    private static final Identifier TEXTURE =
            Identifier.of(OrbitalArsenal.MOD_ID, "textures/entity/mecha_spider.png");

    public MechaSpiderRenderer(EntityRendererFactory.Context context) {
        super(context, new MechaSpiderModel(context.getPart(OrbitalArsenalClient.MECHA_SPIDER_LAYER)), 1.4F);
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
