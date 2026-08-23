package net.minecraft.entity;

import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

public class Entity {
    public boolean velocityModified;
    public HitResult raycast(double d, float t, boolean f) { return null; }
    public Vec3d getEyePos() { return null; }
    public Vec3d getPos() { return null; }
    public Vec3d getVelocity() { return null; }
    public void setVelocity(Vec3d v) {}
    public Vec3d getRotationVec(float t) { return null; }
    public BlockPos getBlockPos() { return null; }
}
