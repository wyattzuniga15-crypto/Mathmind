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

/** Drops a lighthouse, lit, thirty-six blocks tall. */
public class GiantLighthouseItem extends ArsenalItem {
    private static final int REACH = 14;
    private static final int HEIGHT = 95;
    private static final int CRATER = 18;
    private static final int DEPTH = 8;
    private static final int COOLDOWN = 200;

    public GiantLighthouseItem(Settings settings) {
        super(settings, "Drops a lighthouse, lit, thirty-six blocks tall.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantLighthouseItem::paint, REACH, HEIGHT,
                "THE LIGHTHOUSE", (w, u, at) -> {
                    Sculpture.boom(w, at, 7.0F, 220);
                    w.spawnParticles(ParticleTypes.END_ROD, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        double d = Math.sqrt((double) x * x + (double) z * z);
        if (y >= -18 && y <= 8) {
            double r = 7.0 - 3.0 * (y + 18) / 26.0;
            if (d <= r) {
                // Banded the way a lighthouse is painted, and hollow, so it is a
                // tower rather than a very tall post.
                if (d >= r - 1.5) {
                    return ((y + 18) / 4) % 2 == 0
                            ? Blocks.RED_CONCRETE : Blocks.WHITE_CONCRETE;
                }
            }
            return null;
        }
        if (y > 8 && y <= 11 && Sculpture.post(x, z, 0, 0, 5.0)) {
            return Blocks.POLISHED_DEEPSLATE;
        }
        if (y > 11 && y <= 15) {
            if (d >= 3.0 && d <= 4.0) {
                return Blocks.GLASS;
            }
            if (d < 3.0) {
                return Blocks.SEA_LANTERN;
            }
        }
        if (y > 15 && y <= 18 && Sculpture.post(x, z, 0, 0, 5.0 - (y - 15) * 1.4)) {
            return Blocks.POLISHED_DEEPSLATE;
        }
        return null;
    }
}
