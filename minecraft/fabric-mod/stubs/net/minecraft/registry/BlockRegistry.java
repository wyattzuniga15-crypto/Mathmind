package net.minecraft.registry;

import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.util.Identifier;

/** Stands in for the block registry's get(Identifier); the real one is generic. */
public class BlockRegistry {
    public Block get(Identifier id) { return Blocks.AIR; }
}
