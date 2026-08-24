package net.minecraft.client.model;

public final class ModelTransform {
    public static final ModelTransform NONE = new ModelTransform();
    public static ModelTransform origin(float x, float y, float z) { return NONE; }
    public static ModelTransform rotation(float pitch, float yaw, float roll) { return NONE; }
    public static ModelTransform of(float x, float y, float z, float pitch, float yaw, float roll) {
        return NONE;
    }
}
