package net.minecraft.util.math;

public class BlockPos {
    // A no-arg constructor as well as the real one: Mutable extends this, and
    // declaring any constructor removes the implicit one it was relying on.
    public BlockPos() {}
    public BlockPos(int x, int y, int z) {}
    public int getX() { return 0; }
    public int getY() { return 0; }
    public int getZ() { return 0; }
    public BlockPos add(int x, int y, int z) { return this; }
    public BlockPos toImmutable() { return this; }
    public BlockPos up() { return this; }
    public BlockPos up(int n) { return this; }
    public BlockPos down() { return this; }
    public BlockPos down(int n) { return this; }
    public static BlockPos ofFloored(double x, double y, double z) { return null; }
    public static BlockPos ofFloored(Vec3d v) { return null; }
    public static BlockPos fromLong(long packed) { return null; }
    public long asLong() { return 0L; }
    public static class Mutable extends BlockPos { public Mutable set(int x, int y, int z) { return this; } }
}
