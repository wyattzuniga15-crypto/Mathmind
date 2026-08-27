package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
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

/** Slam the ground and a shockwave runs outward, throwing everything it passes. */
public class EarthquakeHammerItem extends Item {
    private static final int RINGS = 30;
    private static final int COOLDOWN = 200;

    public EarthquakeHammerItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = new Vec3d(user.getX(), user.getY(), user.getZ());
        user.sendMessage(Text.literal("§8▁▂▃ EARTHQUAKE"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 20.0F, 0.3F);
        int[] ring = {1};
        Scheduler.repeat(() -> {
            if (ring[0] > RINGS) {
                return false;
            }
            // The wave is a ring that widens, not a sphere that appears: the delay
            // between the slam and being thrown is the whole effect.
            double r = ring[0] * 2.0;
            for (int step = 0; step < 64; step++) {
                double a = step * Math.PI / 32.0;
                double x = at.x + Math.cos(a) * r;
                double z = at.z + Math.sin(a) * r;
                int ground = Area.surface(serverWorld, (int) x, (int) z, (int) at.y);
                serverWorld.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                        x, ground + 1, z, 4, 0.4, 0.3, 0.4, 0.06);
            }
            Area.shove(serverWorld, user, new Vec3d(at.x, at.y, at.z), r + 2.0, 0.9);
            ring[0]++;
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
