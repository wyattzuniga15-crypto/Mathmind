package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import java.util.concurrent.ThreadLocalRandom;
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

/** Cuts a winding canyon across the landscape, the way you are facing. */
public class CanyonCarverItem extends Item {
    private static final int LENGTH = 160;
    private static final int WIDTH = 12;
    private static final int DEPTH = 34;
    private static final int COOLDOWN = 400;

    public CanyonCarverItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        double[] x = {user.getX()};
        double[] z = {user.getZ()};
        int cy = (int) Math.floor(user.getY());
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        double[] heading = {Math.atan2(aim.z, aim.x)};
        int[] step = {0};
        BlockPos.Mutable pos = new BlockPos.Mutable();
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_LIGHTNING_BOLT_THUNDER,
                SoundCategory.MASTER, 4.0F, 0.6F);
        user.sendMessage(Text.literal("§8⌁ Carving…"), true);
        Scheduler.repeat(() -> {
            // One step a tick, not four. Each step scans a disc twenty-five
            // across and some thirty-seven deep — about seventeen thousand
            // blocks — and four of those in a single tick is a visible freeze.
            // At one a tick the canyon takes eight seconds, and you watch it go.
            for (int n = 0; n < 1 && step[0] < LENGTH; n++, step[0]++) {
                // Wanders as it goes, so it is a canyon rather than a trench.
                heading[0] += (ThreadLocalRandom.current().nextDouble() - 0.5) * 0.16;
                x[0] += Math.cos(heading[0]);
                z[0] += Math.sin(heading[0]);
                for (int dx = -WIDTH; dx <= WIDTH; dx++) {
                    for (int dz = -WIDTH; dz <= WIDTH; dz++) {
                        double d = Math.sqrt((double) dx * dx + (double) dz * dz);
                        if (d > WIDTH) {
                            continue;
                        }
                        // Deeper in the middle: vertical walls read as a mineshaft.
                        int deep = (int) (DEPTH * Math.sqrt(1.0 - (d / WIDTH) * (d / WIDTH)));
                        for (int dy = 14; dy > -deep; dy--) {
                            pos.set((int) x[0] + dx, cy + dy, (int) z[0] + dz);
                            BlockState was = serverWorld.getBlockState(pos);
                            if (!was.isAir() && !was.isOf(Blocks.BEDROCK)) {
                                Journal.clear(serverWorld, pos.toImmutable(), was,
                                        Blocks.AIR.getDefaultState());
                            }
                        }
                    }
                }
            }
            if (step[0] < LENGTH) {
                return true;
            }
            user.sendMessage(Text.literal("§8⌁ " + LENGTH + " blocks of canyon."), true);
            return false;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
