package net.minecraft.world;

public class World {
    public enum ExplosionSourceType { TNT }

    // The build limits differ per dimension, so they are asked for rather than
    // assumed. This pair, not the top-Y accessor, which has been renamed
    // across versions.
    public int getBottomY() { return -64; }
    public int getHeight() { return 384; }
}
