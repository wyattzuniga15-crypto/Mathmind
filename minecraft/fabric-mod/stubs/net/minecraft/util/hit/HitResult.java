package net.minecraft.util.hit;

import net.minecraft.util.math.Vec3d;

public class HitResult {
    public enum Type { MISS, BLOCK, ENTITY }
    public Vec3d getPos() { return null; }
    public Type getType() { return Type.MISS; }
}
