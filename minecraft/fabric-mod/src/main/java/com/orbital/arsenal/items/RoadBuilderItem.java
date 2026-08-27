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

/** Lays a paved road ahead of you, levelling whatever is in the way. */
public class RoadBuilderItem extends ArsenalItem {
    private static final int LENGTH = 120;
    private static final int WIDE = 3;
    private static final int COOLDOWN = 300;

    public RoadBuilderItem(Settings settings) {
        super(settings, "Lays a paved road ahead of you, levelling whatever is in the way.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        double flat = Math.sqrt(aim.x * aim.x + aim.z * aim.z);
        if (flat < 0.05) {
            user.sendMessage(Text.literal("§7Look along the ground first."), true);
            return ActionResult.SUCCESS;
        }
        double ux = aim.x / flat;
        double uz = aim.z / flat;
        int[] step = {1};
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§7▬ Building a road…"), true);
        // Read once. Taking it fresh each step made the road follow the player
        // rather than run from where they were standing when they used it.
        double fromX = user.getX();
        double fromZ = user.getZ();
        int fromY = (int) Math.floor(user.getY());
        Scheduler.repeat(() -> {
            if (user.isRemoved()) {
                return false;
            }
            for (int n = 0; n < 4 && step[0] <= LENGTH; n++, step[0]++) {
                int rx = (int) (fromX + ux * step[0]);
                int rz = (int) (fromZ + uz * step[0]);
                // Follows the ground rather than holding one height, so it goes over
                // hills instead of tunnelling through them or bridging past them.
                int ground = Area.surface(serverWorld, rx, rz, fromY);
                for (int side = -WIDE; side <= WIDE; side++) {
                    int sx = rx + (int) (-uz * side);
                    int sz = rz + (int) (ux * side);
                    BlockPos slab = new BlockPos(sx, ground, sz);
                    Journal.clear(serverWorld, slab, serverWorld.getBlockState(slab),
                            Blocks.STONE_BRICKS.getDefaultState());
                    // Head-room above it, or the road runs straight into a hillside.
                    for (int up = 1; up <= 3; up++) {
                        BlockPos clear = new BlockPos(sx, ground + up, sz);
                        BlockState was = serverWorld.getBlockState(clear);
                        if (!was.isAir() && !was.isOf(Blocks.BEDROCK)) {
                            Journal.clear(serverWorld, clear, was, Blocks.AIR.getDefaultState());
                        }
                    }
                }
            }
            if (step[0] <= LENGTH) {
                return true;
            }
            user.sendMessage(Text.literal("§7▬ " + LENGTH + " blocks of road."), true);
            return false;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
