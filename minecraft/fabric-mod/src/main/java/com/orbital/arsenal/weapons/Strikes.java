package com.orbital.arsenal.weapons;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class Strikes {
    private Strikes() {}

    /** Where the player is looking, or the end of their reach if that is sky. */
    public static Vec3d aim(PlayerEntity user, double range) {
        HitResult hit = user.raycast(range, 1.0F, false);
        return hit.getPos();
    }

    public static void blast(ServerWorld world, Vec3d at, float power) {
        world.createExplosion(null, at.x, at.y, at.z, power, World.ExplosionSourceType.TNT);
    }

    public static void puff(ServerWorld world, ParticleEffect effect, Vec3d at,
                            int count, double spread, double speed) {
        world.spawnParticles(effect, at.x, at.y, at.z, count, spread, spread, spread, speed);
    }
}
