package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
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

/** Puts a glass dome over you. Weather stops at the door. */
public class GlassDomeItem extends Item {
    private static final int RADIUS = 18;
    private static final int COOLDOWN = 300;

    public GlassDomeItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int floorY = (int) Math.floor(user.getY()) - 1;
        user.sendMessage(Text.literal("§b◠ Dome."), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_GLASS_BREAK,
                SoundCategory.MASTER, 4.0F, 0.7F);
        Area.sweep(serverWorld, new Vec3d(cx, floorY, cz), RADIUS, RADIUS, RADIUS,
                (dx, dy, dz) -> dy >= 0,
                GlassDomeItem::paint,
                () -> user.sendMessage(Text.literal("§b◠ Sealed. Mind the door."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /**
     * A shell one block thick with a doorway in it, and the inside cleared. A
     * dome with no way out is a tomb, so the north face has a gap in it.
     */
    private static BlockState paint(net.minecraft.server.world.ServerWorld world,
            BlockPos pos, BlockState was, int dx, int dy, int dz) {
        double r = Math.sqrt((double) dx * dx + (double) dy * dy + (double) dz * dz);
        if (r > RADIUS) {
            return null;
        }
        if (r > RADIUS - 1.0) {
            // The doorway: two blocks tall, three wide, due north.
            if (dy <= 2 && Math.abs(dx) <= 1 && dz < 0) {
                return Blocks.AIR.getDefaultState();
            }
            return dy == 0 ? Blocks.STONE_BRICKS.getDefaultState() : Blocks.GLASS.getDefaultState();
        }
        // Everything above the ground goes; the ground itself stays. Clearing
        // dy == 0 as well takes the block the player is standing on out from
        // under them, and the dome is finished before they land.
        if (dy == 0) {
            return null;
        }
        return was.isAir() ? null : Blocks.AIR.getDefaultState();
    }
}
