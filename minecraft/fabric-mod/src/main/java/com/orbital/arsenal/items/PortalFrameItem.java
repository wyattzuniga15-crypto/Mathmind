package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Builds an obsidian frame in front of you and lights it. */
public class PortalFrameItem extends Item {
    private static final int COOLDOWN = 200;

    public PortalFrameItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        int sx = Math.abs(aim.x) > Math.abs(aim.z) ? (aim.x > 0 ? 1 : -1) : 0;
        int sz = sx == 0 ? (aim.z > 0 ? 1 : -1) : 0;
        int cx = (int) Math.floor(user.getX()) + sx * 4;
        int cz = (int) Math.floor(user.getZ()) + sz * 4;
        int base = (int) Math.floor(user.getY());
        // The frame stands across your line of sight, not along it, or you would
        // be looking at its edge.
        int ax = sz == 0 ? 0 : 1;
        int az = sz == 0 ? 1 : 0;
        for (int across = -1; across <= 2; across++) {
            for (int up = -1; up <= 4; up++) {
                boolean edge = across == -1 || across == 2 || up == -1 || up == 4;
                BlockPos spot = new BlockPos(cx + ax * across, base + up, cz + az * across);
                BlockState was = serverWorld.getBlockState(spot);
                BlockState becomes = edge ? Blocks.OBSIDIAN.getDefaultState()
                        : Blocks.AIR.getDefaultState();
                if (was != becomes) {
                    Journal.clear(serverWorld, spot, was, becomes);
                }
            }
        }
        // Lit a tick later. Setting fire in the same pass as the frame lights it
        // before the last obsidian block is there, and an unclosed frame does not
        // take.
        Scheduler.after(2, () -> {
            BlockPos spark = new BlockPos(cx, base, cz);
            Journal.clear(serverWorld, spark, serverWorld.getBlockState(spark),
                    Blocks.FIRE.getDefaultState());
        });
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 1.0F, 0.5F);
        user.sendMessage(Text.literal("§5▯ Frame up. Lighting it."), true);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
