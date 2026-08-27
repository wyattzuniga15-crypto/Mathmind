package com.orbital.arsenal.items;

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

/** Grows a thicket of glowing crystal spires out of the ground. */
public class CrystalGrowthItem extends Item {
    private static final int SPIRES = 40;
    private static final double SPREAD = 20.0;
    private static final int COOLDOWN = 250;

    public CrystalGrowthItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 120.0);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_GLASS_BREAK,
                SoundCategory.MASTER, 3.0F, 1.8F);
        user.sendMessage(Text.literal("§d✧ Crystals."), true);
        ThreadLocalRandom dice = ThreadLocalRandom.current();
        for (int i = 0; i < SPIRES; i++) {
            double a = dice.nextDouble() * Math.PI * 2;
            double r = Math.sqrt(dice.nextDouble()) * SPREAD;
            int sx = (int) (at.x + Math.cos(a) * r);
            int sz = (int) (at.z + Math.sin(a) * r);
            int ground = Area.surface(serverWorld, sx, sz, (int) at.y);
            int height = 6 + dice.nextInt(12);
            // Each spire tapers to a point on its own ground height, so a slope
            // gets a thicket rather than a row of floating shards.
            for (int y = 1; y <= height; y++) {
                int wide = Math.max(0, (int) (2.0 * (1.0 - y / (double) height)));
                for (int dx = -wide; dx <= wide; dx++) {
                    for (int dz = -wide; dz <= wide; dz++) {
                        BlockPos spot = new BlockPos(sx + dx, ground + y, sz + dz);
                        BlockState was = serverWorld.getBlockState(spot);
                        if (was.isAir()) {
                            Journal.clear(serverWorld, spot, was,
                                    (y == height ? Blocks.SEA_LANTERN : Blocks.AMETHYST_BLOCK)
                                            .getDefaultState());
                        }
                    }
                }
            }
        }
        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                at.x, at.y + 6, at.z, 300, SPREAD * 0.5, 4.0, SPREAD * 0.5, 0.04);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
