package net.minecraft.client.render.entity.model;

import net.minecraft.client.model.Model;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.render.entity.state.EntityRenderState;

public abstract class EntityModel<T extends EntityRenderState> extends Model<T> {
    protected EntityModel(ModelPart root) { super(root); }
}
