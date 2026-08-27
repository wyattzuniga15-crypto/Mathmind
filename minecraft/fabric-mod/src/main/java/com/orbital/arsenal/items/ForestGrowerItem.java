package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
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

/** Grows a whole forest where you are looking, tree by tree. */
public class ForestGrowerItem extends Item {
    private static final int RADIUS = 34;
    private static final int TREES = 90;
    private static final int PER_TICK = 3;
    private static final int COOLDOWN = 300;

    public ForestGrowerItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 140.0);
        user.sendMessage(Text.literal("§2🌲 Growing a forest…"), true);
        int[] planted = {0};
        Scheduler.repeat(() -> {
            ThreadLocalRandom dice = ThreadLocalRandom.current();
            for (int n = 0; n < PER_TICK && planted[0] < TREES; n++, planted[0]++) {
                double a = dice.nextDouble() * Math.PI * 2;
                double r = Math.sqrt(dice.nextDouble()) * RADIUS;
                int tx = (int) (at.x + Math.cos(a) * r);
                int tz = (int) (at.z + Math.sin(a) * r);
                // Each tree finds its own ground: one height across a hillside
                // leaves half the forest buried and half standing in the air.
                int ground = Area.surface(serverWorld, tx, tz, (int) at.y);
                int height = 5 + dice.nextInt(5);
                for (int y = 1; y <= height; y++) {
                    BlockPos trunk = new BlockPos(tx, ground + y, tz);
                    Journal.clear(serverWorld, trunk, serverWorld.getBlockState(trunk),
                            Blocks.OAK_LOG.getDefaultState());
                }
                // Sqrt of a uniform draw for the radius, not the draw itself, or
                // every tree bunches into the middle.
                for (int lx = -2; lx <= 2; lx++) {
                    for (int ly = -2; ly <= 2; ly++) {
                        for (int lz = -2; lz <= 2; lz++) {
                            if (lx * lx + ly * ly + lz * lz > 5) {
                                continue;
                            }
                            BlockPos leaf = new BlockPos(tx + lx, ground + height + ly, tz + lz);
                            BlockState was = serverWorld.getBlockState(leaf);
                            if (was.isAir()) {
                                Journal.clear(serverWorld, leaf, was, Blocks.OAK_LEAVES.getDefaultState());
                            }
                        }
                    }
                }
            }
            if (planted[0] < TREES) {
                return true;
            }
            user.sendMessage(Text.literal("§2🌲 " + TREES + " trees."), true);
            return false;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
