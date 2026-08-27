package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Sculpture;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Drops a light bulb, lit, with the filament still in it. */
public class GiantLightBulbItem extends ArsenalItem {
    private static final int REACH = 16;
    private static final int HEIGHT = 100;
    private static final int CRATER = 14;
    private static final int DEPTH = 8;
    private static final int COOLDOWN = 200;

    public GiantLightBulbItem(Settings settings) {
        super(settings, "Drops a light bulb, lit, with the filament still in it.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantLightBulbItem::paint, REACH, HEIGHT,
                "LIGHT BULB", (w, u, at) -> {
                    Sculpture.boom(w, at, 6.0F, 220);
                    w.spawnParticles(ParticleTypes.END_ROD, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        double d = Math.sqrt((double) x * x + (double) z * z);
        if (y >= -2 && y <= 18) {
            double r = 11.0 * Math.sin(Math.PI * (0.12 + 0.8 * (y + 2) / 20.0));
            if (d >= r - 1.5 && d <= r) {
                return Blocks.GLASS;
            }
            if (d < r - 1.5) {
                // The filament, on two posts, inside the glass rather than through it.
                if (Math.abs(x) <= 1 && y >= 2 && y <= 10 && Math.abs(z) <= 1) {
                    return Blocks.GLOWSTONE;
                }
                if (y >= 9 && y <= 11 && Math.abs(x) <= 5 && Math.abs(z) <= 1
                        && Math.floorMod(x + y, 3) == 0) {
                    return Blocks.GLOWSTONE;
                }
                return null;
            }
        }
        if (y >= -8 && y < -2 && Sculpture.post(x, z, 0, 0, 5.0)) {
            return Blocks.IRON_BLOCK;
        }
        // The screw thread: a radius that steps in and out every three blocks.
        if (y >= -16 && y < -8
                && Sculpture.post(x, z, 0, 0, 6.0 - Math.floorMod(y + 16, 3) * 0.9)) {
            return Blocks.IRON_BLOCK;
        }
        if (y >= -19 && y < -16 && Sculpture.post(x, z, 0, 0, 3.0)) {
            return Blocks.BLACK_CONCRETE;
        }
        return null;
    }
}
