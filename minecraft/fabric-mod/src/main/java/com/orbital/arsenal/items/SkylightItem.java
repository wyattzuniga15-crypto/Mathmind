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

/** Bores a shaft straight up from where you stand, out to open sky. */
public class SkylightItem extends Item {
    private static final int R = 3;
    private static final int COOLDOWN = 100;

    public SkylightItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int roof = serverWorld.getBottomY() + serverWorld.getHeight() - 1;
        // floor(), not a cast: below y=0 a cast rounds toward zero, which starts
        // the shaft above the player's head and leaves them still buried.
        int feet = (int) Math.floor(user.getY());
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_LIGHTNING_BOLT_THUNDER,
                SoundCategory.MASTER, 4.0F, 0.6F);
        int[] cleared = {0};
        Area.column(serverWorld, new Vec3d(cx, feet, cz), R, roof - feet, 0,
                (w, pos, was, dx, dy, dz) -> {
                    if (was.isAir()) {
                        return null;
                    }
                    cleared[0]++;
                    return Blocks.AIR.getDefaultState();
                },
                () -> user.sendMessage(
                        Text.literal("§e☼ " + cleared[0] + " blocks. Look up."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
