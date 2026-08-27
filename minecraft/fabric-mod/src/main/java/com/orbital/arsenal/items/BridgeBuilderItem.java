package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Throws a railed bridge across whatever gap is in front of you. */
public class BridgeBuilderItem extends ArsenalItem {
    private static final int LENGTH = 90;
    private static final int COOLDOWN = 250;

    public BridgeBuilderItem(Settings settings) {
        super(settings, "Throws a railed bridge across whatever gap is in front of you.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        double flat = Math.sqrt(aim.x * aim.x + aim.z * aim.z);
        if (flat < 0.05) {
            user.sendMessage(Text.literal("§7Look across the gap first."), true);
            return ActionResult.SUCCESS;
        }
        double ux = aim.x / flat;
        double uz = aim.z / flat;
        int deck = (int) Math.floor(user.getY()) - 1;
        int[] step = {1};
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§7═ Bridging…"), true);
        // The start is read once, here, not inside the loop. Reading it every
        // step meant walking while it built dragged the far end along with you,
        // and walking backwards shortened the bridge you were standing on.
        double fromX = user.getX();
        double fromZ = user.getZ();
        Scheduler.repeat(() -> {
            if (user.isRemoved()) {
                return false;
            }
            for (int n = 0; n < 6 && step[0] <= LENGTH; n++, step[0]++) {
                int bx = (int) (fromX + ux * step[0]);
                int bz = (int) (fromZ + uz * step[0]);
                // Held at one height on purpose — a bridge that followed the ground
                // would be a road, and would sink into the gap it is meant to cross.
                for (int side = -2; side <= 2; side++) {
                    int sx = bx + (int) (-uz * side);
                    int sz = bz + (int) (ux * side);
                    BlockPos plank = new BlockPos(sx, deck, sz);
                    BlockState was = serverWorld.getBlockState(plank);
                    if (was.isAir() || was.isOf(Blocks.WATER) || was.isOf(Blocks.LAVA)) {
                        Journal.clear(serverWorld, plank, was, Blocks.OAK_PLANKS.getDefaultState());
                    }
                    if (Math.abs(side) == 2) {
                        BlockPos rail = new BlockPos(sx, deck + 1, sz);
                        BlockState above = serverWorld.getBlockState(rail);
                        if (above.isAir()) {
                            Journal.clear(serverWorld, rail, above, Blocks.OAK_LOG.getDefaultState());
                        }
                    }
                }
            }
            if (step[0] <= LENGTH) {
                return true;
            }
            user.sendMessage(Text.literal("§7═ Across."), true);
            return false;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
