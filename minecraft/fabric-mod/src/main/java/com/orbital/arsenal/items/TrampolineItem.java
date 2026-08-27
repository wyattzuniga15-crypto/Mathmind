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

/** Lays a slime pad that throws anything landing on it thirty blocks up. */
public class TrampolineItem extends Item {
    private static final int RADIUS = 6;
    private static final int DURATION = 1200;
    private static final int COOLDOWN = 120;

    public TrampolineItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int ground = Area.surface(serverWorld, cx, cz, (int) user.getY());
        Vec3d pad = new Vec3d(cx, ground, cz);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§a◎ Jump."), true);
        Area.column(serverWorld, pad, RADIUS, 0, 0, (w, pos, was, dx, dy, dz) ->
                Blocks.SLIME_BLOCK.getDefaultState(), null);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION) {
                return false;
            }
            for (Entity thing : Area.living(serverWorld, null, pad, RADIUS + 1)) {
                // Only things coming down. Bouncing whatever is already rising
                // would pin it in the air for as long as the pad lasted.
                if (thing.getVelocity().y < -0.08 && thing.getY() - ground < 3.0) {
                    thing.setVelocity(new Vec3d(thing.getVelocity().x, 1.35, thing.getVelocity().z));
                }
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
