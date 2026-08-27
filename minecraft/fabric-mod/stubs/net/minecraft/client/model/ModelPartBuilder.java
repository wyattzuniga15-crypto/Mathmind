package net.minecraft.client.model;

public class ModelPartBuilder {
    public static ModelPartBuilder create() { return new ModelPartBuilder(); }
    public ModelPartBuilder uv(int u, int v) { return this; }
    public ModelPartBuilder cuboid(float x, float y, float z, float sx, float sy, float sz) {
        return this;
    }
}
