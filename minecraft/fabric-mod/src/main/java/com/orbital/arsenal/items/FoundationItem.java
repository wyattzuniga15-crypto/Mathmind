package com.orbital.arsenal.items;

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

/** Flattens the ground around you to one level and paves it. */
public class FoundationItem extends ArsenalItem {
    private static final int RADIUS = 22;
    private static final int COOLDOWN = 250;

    public FoundationItem(Settings settings) {
        super(settings, "Flattens the ground around you to one level and paves it.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cy = (int) Math.floor(user.getY()) - 1;
        Vec3d here = new Vec3d(user.getX(), cy, user.getZ());
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_LIGHTNING_BOLT_THUNDER,
                SoundCategory.MASTER, 4.0F, 0.6F);
        user.sendMessage(Text.literal("§7▤ Levelling."), true);
        // Everything above the line goes, everything at or below it becomes stone.
        // One pass, so a hillside is cut and the hollow behind it filled together.
        Area.column(serverWorld, here, RADIUS, 40, 6, (w, pos, was, dx, dy, dz) -> {
            if (dy > 0) {
                return was.isAir() ? null : Blocks.AIR.getDefaultState();
            }
            return Blocks.STONE_BRICKS.getDefaultState();
        }, () -> user.sendMessage(Text.literal("§7▤ Flat. Build something."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
