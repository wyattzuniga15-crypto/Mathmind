package net.minecraft.client.render.entity;

import net.minecraft.client.render.entity.model.EntityModel;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;
import net.minecraft.entity.LivingEntity;
import net.minecraft.util.Identifier;

public abstract class LivingEntityRenderer<
        T extends LivingEntity,
        S extends LivingEntityRenderState,
        M extends EntityModel<? super S>> extends EntityRenderer<T, S> {
    public LivingEntityRenderer(EntityRendererFactory.Context context, M model, float shadowRadius) {}
    public Identifier getTexture(S state) { return null; }
}
