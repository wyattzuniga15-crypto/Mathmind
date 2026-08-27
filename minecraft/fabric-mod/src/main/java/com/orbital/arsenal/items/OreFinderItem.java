package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
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

/** Lights up every ore within forty blocks for fifteen seconds, through solid rock. */
public class OreFinderItem extends ArsenalItem {
    private static final int RADIUS = 40;
    private static final int SHOWS = 300;
    private static final int COOLDOWN = 300;

    public OreFinderItem(Settings settings) {
        super(settings, "Lights up every ore within forty blocks for fifteen seconds, through solid rock.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cy = (int) Math.floor(user.getY());
        int cz = (int) Math.floor(user.getZ());
        java.util.List<BlockPos> found = new java.util.ArrayList<>();
        BlockPos.Mutable pos = new BlockPos.Mutable();
        for (int x = -RADIUS; x <= RADIUS; x += 1) {
            for (int y = -RADIUS; y <= RADIUS; y += 1) {
                for (int z = -RADIUS; z <= RADIUS; z += 1) {
                    if (x * x + y * y + z * z > RADIUS * RADIUS) {
                        continue;
                    }
                    pos.set(cx + x, cy + y, cz + z);
                    String id = serverWorld.getBlockState(pos).toString();
                    // Matched by name rather than against a list of every ore block:
                    // the list grows every version and a missing entry is invisible.
                    if (id.contains("_ore")) {
                        found.add(pos.toImmutable());
                    }
                }
            }
        }
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 1.2F, 1.4F);
        user.sendMessage(Text.literal("§b◈ " + found.size() + " ores nearby"), true);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > SHOWS) {
                return false;
            }
            for (BlockPos ore : found) {
                serverWorld.spawnParticles(ParticleTypes.HAPPY_VILLAGER, true, true,
                        ore.getX() + 0.5, ore.getY() + 0.5, ore.getZ() + 0.5, 1, 0.0, 0.0, 0.0, 0.0);
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
