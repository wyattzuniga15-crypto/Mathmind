package com.orbital.arsenal.client;

import com.orbital.arsenal.OrbitalArsenal;
import com.orbital.arsenal.entity.PhoenixEntity;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.MobEntityRenderer;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;
import net.minecraft.util.Identifier;

/** Draws the Phoenix. Model and texture only; the draw call is Minecraft's. */
public class PhoenixRenderer
        extends MobEntityRenderer<PhoenixEntity, LivingEntityRenderState, PhoenixModel> {

    private static final Identifier TEXTURE =
            Identifier.of(OrbitalArsenal.MOD_ID, "textures/entity/phoenix.png");

    public PhoenixRenderer(EntityRendererFactory.Context context) {
        super(context, new PhoenixModel(context.getPart(OrbitalArsenalClient.PHOENIX_LAYER)), 1.4F);
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
