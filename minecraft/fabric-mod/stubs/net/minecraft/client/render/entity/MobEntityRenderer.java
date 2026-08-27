package net.minecraft.client.render.entity;

import net.minecraft.client.render.entity.model.EntityModel;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;
import net.minecraft.entity.mob.MobEntity;

public abstract class MobEntityRenderer<
        T extends MobEntity,
        S extends LivingEntityRenderState,
        M extends EntityModel<? super S>> extends LivingEntityRenderer<T, S, M> {
    public MobEntityRenderer(EntityRendererFactory.Context context, M model, float shadowRadius) {
        super(context, model, shadowRadius);
    }
}
