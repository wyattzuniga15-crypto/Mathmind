package net.minecraft.util.math;

public class Vec3d {
    public double x, y, z;
    public Vec3d add(double a, double b, double c) { return this; }
    public Vec3d add(Vec3d other) { return this; }
    public Vec3d subtract(Vec3d other) { return this; }
    public Vec3d subtract(double a, double b, double c) { return this; }
    public Vec3d multiply(double s) { return this; }
    public Vec3d normalize() { return this; }
    public double length() { return 0.0; }
    public static Vec3d ofCenter(BlockPos pos) { return null; }
}
