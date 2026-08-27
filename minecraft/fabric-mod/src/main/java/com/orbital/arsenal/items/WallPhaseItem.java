package com.orbital.arsenal.items;

import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Bores a person-sized passage straight through whatever is in front of you. */
public class WallPhaseItem extends Item {
    private static final int DEPTH = 24;
    private static final int COOLDOWN = 60;

    public WallPhaseItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        Vec3d from = new Vec3d(user.getX(), user.getY() + 1.0, user.getZ());
        BlockPos.Mutable pos = new BlockPos.Mutable();
        int cleared = 0;
        for (int step = 1; step <= DEPTH; step++) {
            Vec3d p = from.add(aim.multiply(step));
            // Two tall and one wide across the aim, which is the shape of a person
            // rather than of a tunnel — this is for getting through, not mining.
            for (int up = 0; up <= 1; up++) {
                for (int side = -1; side <= 1; side++) {
                    pos.set((int) Math.floor(p.x) + (Math.abs(aim.z) > Math.abs(aim.x) ? side : 0),
                            (int) Math.floor(p.y) + up,
                            (int) Math.floor(p.z) + (Math.abs(aim.z) > Math.abs(aim.x) ? 0 : side));
                    BlockState was = serverWorld.getBlockState(pos);
                    if (!was.isAir() && !was.isOf(Blocks.BEDROCK)) {
                        Journal.clear(serverWorld, pos.toImmutable(), was, Blocks.AIR.getDefaultState());
                        cleared++;
                    }
                }
            }
        }
        user.sendMessage(Text.literal("§7▭ " + cleared + " blocks out of the way"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_GLASS_BREAK,
                SoundCategory.PLAYERS, 2.0F, 0.8F);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
