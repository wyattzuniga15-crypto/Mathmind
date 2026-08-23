package net.minecraft.util.math;

public class BlockPos {
    public BlockPos toImmutable() { return this; }
    public BlockPos up() { return this; }
    public static BlockPos ofFloored(Vec3d v) { return null; }
    public static BlockPos fromLong(long packed) { return null; }
    public long asLong() { return 0L; }
    public static class Mutable extends BlockPos { public Mutable set(int x, int y, int z) { return this; } }
}
