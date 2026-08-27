package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Drives a ring of ice spears up out of the ground around you. */
public class IceSpikesItem extends ArsenalItem {
    private static final int SPIKES = 24;
    private static final double RING = 9.0;
    private static final int COOLDOWN = 100;

    public IceSpikesItem(Settings settings) {
        super(settings, "Drives a ring of ice spears up out of the ground around you.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d here = new Vec3d(user.getX(), user.getY(), user.getZ());
        for (int i = 0; i < SPIKES; i++) {
            double a = i * Math.PI * 2 / SPIKES;
            int sx = (int) (user.getX() + Math.cos(a) * RING);
            int sz = (int) (user.getZ() + Math.sin(a) * RING);
            int ground = Area.surface(serverWorld, sx, sz, (int) user.getY());
            // Each spike is its own tapering column, grown from the real ground
            // height at that spot rather than the player's — on a slope a single
            // height leaves half of them buried and half floating.
            Vec3d root = new Vec3d(sx, ground + 1, sz);
            Area.sweep(serverWorld, root, 2, 7, 2,
                    (dx, dy, dz) -> dy >= 0 && Math.abs(dx) + Math.abs(dz) <= 2 - dy / 4,
                    (w, pos, was, dx, dy, dz) -> was.isAir() ? Blocks.PACKED_ICE.getDefaultState() : null,
                    null);
        }
        Area.shove(serverWorld, user, here, RING + 3.0, 1.1);
        user.sendMessage(Text.literal("§b❄ " + SPIKES + " spikes"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_GLASS_BREAK,
                SoundCategory.PLAYERS, 4.0F, 0.7F);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
