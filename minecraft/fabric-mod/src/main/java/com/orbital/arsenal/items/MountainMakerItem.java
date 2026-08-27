package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
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

/** Raises a mountain where you are looking, course by course. */
public class MountainMakerItem extends Item {
    private static final int HEIGHT = 70;
    private static final double BASE = 46.0;
    private static final int COOLDOWN = 500;

    public MountainMakerItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 140.0);
        int cx = (int) Math.floor(at.x);
        int cy = (int) Math.floor(at.y);
        int cz = (int) Math.floor(at.z);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_LIGHTNING_BOLT_THUNDER,
                SoundCategory.MASTER, 4.0F, 0.6F);
        user.sendMessage(Text.literal("§7⛰ Raising a mountain…"), true);
        int[] course = {0};
        BlockPos.Mutable pos = new BlockPos.Mutable();
        Scheduler.repeat(() -> {
            if (course[0] >= HEIGHT) {
                user.sendMessage(Text.literal("§7⛰ " + HEIGHT + " blocks tall."), true);
                return false;
            }
            int up = course[0];
            double t = up / (double) HEIGHT;
            // Curved profile rather than a straight taper: a linear cone reads as a
            // pyramid, and the snow line near the summit is what sells it.
            double r = BASE * Math.pow(1.0 - t, 0.8);
            int span = (int) Math.ceil(r);
            for (int x = -span; x <= span; x++) {
                for (int z = -span; z <= span; z++) {
                    if (x * x + z * z > r * r) {
                        continue;
                    }
                    pos.set(cx + x, cy + up, cz + z);
                    BlockState was = serverWorld.getBlockState(pos);
                    BlockState rock = t > 0.78 ? Blocks.SNOW_BLOCK.getDefaultState()
                            : Blocks.STONE.getDefaultState();
                    if (was != rock) {
                        Journal.clear(serverWorld, pos.toImmutable(), was, rock);
                    }
                }
            }
            course[0]++;
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
