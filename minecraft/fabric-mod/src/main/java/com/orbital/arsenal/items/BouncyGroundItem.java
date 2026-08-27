package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
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

/** Turns the ground around you to slime for a minute. Everything bounces. */
public class BouncyGroundItem extends Item {
    private static final int RADIUS = 16;
    private static final int DURATION = 1_200;
    private static final int COOLDOWN = 300;

    public BouncyGroundItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d here = new Vec3d(user.getX(), user.getY(), user.getZ());
        user.sendMessage(Text.literal("§a◯ Boing."), true);
        Area.column(serverWorld, here, RADIUS, 1, 2, (w, pos, was, dx, dy, dz) ->
                (!was.isAir() && w.getBlockState(pos.up()).isAir())
                        ? Blocks.SLIME_BLOCK.getDefaultState() : null, null);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION) {
                return false;
            }
            // Vanilla slime only bounces things that are already falling fast. This
            // gives anything on the ground a nudge, so it bounces even standing.
            for (Entity thing : Area.living(serverWorld, null, here, RADIUS)) {
                if (thing.isOnGround()) {
                    thing.addVelocity(0, 0.62, 0);
                }
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
