package net.minecraft.entity;

import net.minecraft.block.BlockState;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
public class FallingBlockEntity extends Entity {
    public boolean dropItem;
    public static FallingBlockEntity spawnFromBlock(ServerWorld w, BlockPos p, BlockState s) { return null; }
}
