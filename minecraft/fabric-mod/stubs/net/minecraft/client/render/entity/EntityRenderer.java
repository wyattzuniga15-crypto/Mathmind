package net.minecraft.client.render.entity;

import net.minecraft.client.render.entity.state.EntityRenderState;
import net.minecraft.entity.Entity;
import net.minecraft.util.Identifier;

public abstract class EntityRenderer<T extends Entity, S extends EntityRenderState> {
    public abstract S createRenderState();
}
