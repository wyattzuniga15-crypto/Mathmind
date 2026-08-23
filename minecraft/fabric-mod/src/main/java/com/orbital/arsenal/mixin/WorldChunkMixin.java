package com.orbital.arsenal.mixin;

import com.orbital.arsenal.time.Journal;
import net.minecraft.block.BlockState;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.chunk.WorldChunk;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Files every block change in the world, whoever made it.
 *
 * This is the only chokepoint every change passes through — a player placing a
 * block, water spreading, and a TNT blast tearing a crater all end up here. The
 * weapons in this mod could record their own clearing without any of this, but
 * the cannon and the meteor storm break blocks through vanilla's explosion
 * code, which the mod never sees. Without this hook the clock could not undo
 * either of them.
 *
 * `require = 0` on the injection is deliberate. If this method's shape ever
 * moves, the mixin quietly does nothing rather than refusing to load the mod —
 * the clock loses its reach over third-party changes, everything else still
 * works, and the mod still starts.
 */
@Mixin(WorldChunk.class)
public abstract class WorldChunkMixin {
    @Inject(method = "setBlockState", at = @At("HEAD"), require = 0)
    private void orbital$journal(BlockPos pos, BlockState state, int flags,
                                 CallbackInfoReturnable<BlockState> info) {
        // Both of these are a static field read, which matters: this method
        // runs on every block change in the game, including ones no weapon of
        // this mod had anything to do with.
        if (Journal.suppressed || !Journal.recording()) {
            return;
        }
        WorldChunk self = (WorldChunk) (Object) this;
        if (self.getWorld() instanceof ServerWorld server) {
            Journal.record(server, pos, self.getBlockState(pos));
        }
    }
}
