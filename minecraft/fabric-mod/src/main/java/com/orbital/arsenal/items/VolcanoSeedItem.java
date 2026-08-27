package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Shells;
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

/**
 * Plant it, and a volcano grows out of the ground — then erupts.
 *
 * The cone is raised a course at a time from the bottom up, which is the whole
 * appeal: a mountain that appears in one tick is a screenshot, one that climbs
 * for ten seconds is an event. Each course is a ring rather than a disc, so the
 * inside stays hollow and becomes the vent without a second pass to carve it.
 */
public class VolcanoSeedItem extends Item {
    private static final int HEIGHT = 60;
    private static final double BASE = 34.0;
    private static final double VENT = 5.0;
    /** Courses per tick: ten seconds from flat ground to summit. */
    private static final int PER_TICK = 1;
    private static final int ERUPTION = 700;
    private static final int COOLDOWN = 600;

    public VolcanoSeedItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Vec3d target = Strikes.aim(user, 120.0);
        user.sendMessage(Text.literal("§c🌋 Stand back."), true);
        serverWorld.playSound(null, BlockPos.ofFloored(target), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 6.0F, 0.3F);

        int cx = (int) Math.floor(target.x);
        int cy = (int) Math.floor(target.y);
        int cz = (int) Math.floor(target.z);
        int[] course = {0};
        BlockPos.Mutable pos = new BlockPos.Mutable();

        Scheduler.repeat(() -> {
            for (int n = 0; n < PER_TICK && course[0] < HEIGHT; n++, course[0]++) {
                int up = course[0];
                double t = up / (double) HEIGHT;
                // Tapering outer wall, and a vent that narrows with it so the
                // throat stays open all the way to the summit.
                double outer = BASE * (1.0 - t) + 4.0;
                double inner = Math.max(0.0, VENT * (1.0 - t * 0.6));
                int span = (int) Math.ceil(outer);
                for (int x = -span; x <= span; x++) {
                    for (int z = -span; z <= span; z++) {
                        double d = Math.sqrt((double) x * x + (double) z * z);
                        if (d > outer || d < inner) {
                            continue;
                        }
                        pos.set(cx + x, cy + up, cz + z);
                        BlockState was = serverWorld.getBlockState(pos);
                        // Basalt outside, magma at the lip so the rim glows.
                        BlockState rock = (d > outer - 1.5 && up > HEIGHT / 2)
                                ? Blocks.MAGMA_BLOCK.getDefaultState()
                                : Blocks.BLACKSTONE.getDefaultState();
                        Journal.clear(serverWorld, pos.toImmutable(), was, rock);
                    }
                }
                if (up % 6 == 0) {
                    serverWorld.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                            target.x, cy + up, target.z, 30, outer * 0.5, 1.0, outer * 0.5, 0.05);
                }
            }
            if (course[0] < HEIGHT) {
                return true;
            }
            erupt(serverWorld, user, new Vec3d(target.x, cy + HEIGHT, target.z));
            return false;
        });

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /** Fill the throat with lava, then throw bombs out of it for a while. */
    private void erupt(ServerWorld world, PlayerEntity user, Vec3d summit) {
        user.sendMessage(Text.literal("§6🌋 ERUPTION"), true);
        world.playSound(null, BlockPos.ofFloored(summit), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 100.0F, 0.4F);

        int cx = (int) Math.floor(summit.x);
        int cz = (int) Math.floor(summit.z);
        int cy = (int) Math.floor(summit.y);
        BlockPos.Mutable pos = new BlockPos.Mutable();
        BlockState lava = Blocks.LAVA.getDefaultState();
        for (int x = -3; x <= 3; x++) {
            for (int z = -3; z <= 3; z++) {
                if (x * x + z * z > 9) {
                    continue;
                }
                pos.set(cx + x, cy - 1, cz + z);
                Journal.clear(world, pos.toImmutable(), world.getBlockState(pos), lava);
            }
        }

        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > ERUPTION) {
                return false;
            }
            if (age[0] % 8 == 0) {
                ThreadLocalRandom dice = ThreadLocalRandom.current();
                double angle = dice.nextDouble() * Math.PI * 2;
                double r = dice.nextDouble() * 3.0;
                // Lava bombs, thrown from the vent rather than dropped on it.
                Shells.drop(world, summit.x + Math.cos(angle) * r,
                        summit.y + 24 + dice.nextDouble() * 10,
                        summit.z + Math.sin(angle) * r);
            }
            world.spawnParticles(ParticleTypes.FLAME, true, true,
                    summit.x, summit.y + 2, summit.z, 40, 2.0, 3.0, 2.0, 0.3);
            world.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                    summit.x, summit.y + 8, summit.z, 30, 4.0, 4.0, 4.0, 0.1);
            return true;
        });
    }
}
