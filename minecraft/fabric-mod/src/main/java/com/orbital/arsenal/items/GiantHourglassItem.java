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

/** An hourglass thirty blocks tall, with the sand still in it. */
public class GiantHourglassItem extends ArsenalItem {
    private static final int REACH = 16;
    private static final int HEIGHT = 100;
    private static final int CRATER = 16;
    private static final int DEPTH = 10;
    private static final int COOLDOWN = 200;

    public GiantHourglassItem(Settings settings) {
        super(settings, "An hourglass thirty blocks tall, with the sand still in it.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantHourglassItem::paint, REACH, HEIGHT,
                "THE HOURGLASS", (w, u, at) -> {
                    Sculpture.boom(w, at, 6.0F, 220);
                    w.spawnParticles(ParticleTypes.CLOUD, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (Math.abs(y) > 14) {
            return null;
        }
        double t = Math.abs(y) / 14.0;
        double r = 2.0 + 7.0 * t;
        double d = Math.sqrt((double) x * x + (double) z * z);
        if (Math.abs(y) == 14 && d <= r) {
            return Blocks.OAK_LOG;
        }
        if (d >= r - 1.5 && d <= r) {
            return Blocks.GLASS;
        }
        // Sand in the lower bulb only, and inside the glass. Without the bound it
        // pooled straight out through the bottom cap.
        if (y >= -13 && y < -6 && d <= r - 1.5) {
            return Blocks.SAND;
        }
        return null;
    }
}
