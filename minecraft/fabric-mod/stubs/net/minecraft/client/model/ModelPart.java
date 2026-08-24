package net.minecraft.client.model;

// Fields and methods taken from javap against the remapped 1.21.11 jar.
public final class ModelPart {
    public float originX, originY, originZ;
    public float pitch, yaw, roll;
    public float xScale, yScale, zScale;
    public boolean visible, hidden;
    public ModelPart getChild(String name) { return this; }
    public void setOrigin(float x, float y, float z) {}
    public void setAngles(float pitch, float yaw, float roll) {}
}
