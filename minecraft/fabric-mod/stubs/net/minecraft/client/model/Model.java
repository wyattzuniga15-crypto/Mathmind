package net.minecraft.client.model;

import net.minecraft.client.render.entity.state.EntityRenderState;

public abstract class Model<T extends EntityRenderState> {
    protected Model(ModelPart root) {}
    public void setAngles(T state) {}
}
