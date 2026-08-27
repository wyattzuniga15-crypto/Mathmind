package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
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

/** Digs a clean rectangular pit in front of you, thirty across and twenty deep. */
public class ExcavatorItem extends ArsenalItem {
    private static final int HALF = 15;
    private static final int DEPTH = 20;
    private static final int COOLDOWN = 200;

    public ExcavatorItem(Settings settings) {
        super(settings, "Digs a clean rectangular pit in front of you, thirty across and twenty deep.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 120.0);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_LIGHTNING_BOLT_THUNDER,
                SoundCategory.MASTER, 4.0F, 0.6F);
        user.sendMessage(Text.literal("§7▣ Digging."), true);
        // Square rather than a bowl: this is for clearing a build site, and a
        // crater with sloped walls is no use to anyone laying foundations.
        Area.sweep(serverWorld, at, HALF, DEPTH, HALF,
                (dx, dy, dz) -> dy <= 2 && dy >= -DEPTH,
                (w, pos, was, dx, dy, dz) -> was.isAir() ? null : Blocks.AIR.getDefaultState(),
                () -> user.sendMessage(Text.literal("§7▣ Flat and square."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
