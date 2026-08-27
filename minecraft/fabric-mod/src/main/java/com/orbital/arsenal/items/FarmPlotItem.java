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

/** Levels a field, tills it, plants it with wheat and puts the water in. */
public class FarmPlotItem extends Item {
    private static final int HALF = 11;
    private static final int COOLDOWN = 300;

    public FarmPlotItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int soil = (int) Math.floor(user.getY()) - 1;
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_LIGHTNING_BOLT_THUNDER,
                SoundCategory.MASTER, 4.0F, 0.6F);
        user.sendMessage(Text.literal("§2▦ Ploughing."), true);
        Area.sweep(serverWorld, new Vec3d(cx, soil, cz), HALF, 6, HALF,
                (dx, dy, dz) -> dy >= -1 && dy <= 4,
                FarmPlotItem::paint,
                () -> user.sendMessage(Text.literal("§2▦ Come back in a while."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /**
     * Water in a channel every fourth row, because farmland dries out more than
     * four blocks from any, and dry farmland grows nothing.
     */
    private static BlockState paint(net.minecraft.server.world.ServerWorld world,
            BlockPos pos, BlockState was, int dx, int dy, int dz) {
        boolean channel = Math.floorMod(dz, 8) == 0;
        if (dy > 1) {
            return was.isAir() ? null : Blocks.AIR.getDefaultState();
        }
        if (dy == 1) {
            return channel ? Blocks.AIR.getDefaultState() : Blocks.WHEAT.getDefaultState();
        }
        if (dy == 0) {
            return channel ? Blocks.WATER.getDefaultState() : Blocks.FARMLAND.getDefaultState();
        }
        return Blocks.DIRT.getDefaultState();
    }
}
