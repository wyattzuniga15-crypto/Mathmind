package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.entity.Entity;
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

/** Trades places with whatever you are looking at. */
public class SwapItem extends ArsenalItem {
    private static final double GRAB = 5.0;
    private static final int COOLDOWN = 100;

    public SwapItem(Settings settings) {
        super(settings, "Trades places with whatever you are looking at.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 60.0);
        Entity best = null;
        double nearest = Double.MAX_VALUE;
        for (Entity thing : Area.mobs(serverWorld, user, at, GRAB)) {
            double dx = thing.getX() - at.x;
            double dy = thing.getY() - at.y;
            double dz = thing.getZ() - at.z;
            double away = dx * dx + dy * dy + dz * dz;
            if (away < nearest) {
                nearest = away;
                best = thing;
            }
        }
        if (best == null) {
            user.sendMessage(Text.literal("§7Nothing there to swap with."), true);
            return ActionResult.SUCCESS;
        }
        // Both positions are read before either is written. Moving the player
        // first and then reading their position puts the mob where it already was.
        double px = user.getX();
        double py = user.getY();
        double pz = user.getZ();
        double mx = best.getX();
        double my = best.getY();
        double mz = best.getZ();
        user.setPosition(mx, my, mz);
        best.setPosition(px, py, pz);
        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true, px, py + 1, pz,
                50, 0.4, 0.8, 0.4, 0.05);
        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true, mx, my + 1, mz,
                50, 0.4, 0.8, 0.4, 0.05);
        serverWorld.playSound(null, BlockPos.ofFloored(mx, my, mz),
                SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP, SoundCategory.MASTER, 1.0F, 0.6F);
        user.sendMessage(Text.literal("§d⇄ Swapped."), true);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
