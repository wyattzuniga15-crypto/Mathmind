package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Sculpture;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Drops a windmill, sails and all. The sails do not turn. */
public class GiantWindmillItem extends Item {
    private static final int REACH = 16;
    private static final int HEIGHT = 100;
    private static final int CRATER = 18;
    private static final int DEPTH = 8;
    private static final int COOLDOWN = 200;

    public GiantWindmillItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantWindmillItem::paint, REACH, HEIGHT,
                "THE WINDMILL", (w, u, at) -> {
                    Sculpture.boom(w, at, 8.0F, 220);
                    w.spawnParticles(ParticleTypes.CLOUD, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        double d = Math.sqrt((double) x * x + (double) z * z);
        if (y >= -16 && y <= 6) {
            double r = 7.0 - 3.5 * (y + 16) / 22.0;
            if (d >= r - 1.5 && d <= r) {
                return Blocks.WHITE_CONCRETE;
            }
            if (y == -16 && d <= r) {
                return Blocks.WHITE_CONCRETE;
            }
        }
        if (y > 6 && y <= 10 && d <= 7.0 - (y - 6) * 1.6) {
            return Blocks.RED_CONCRETE;
        }
        // Four sails on a hub set out in front of the tower, at forty-five degrees
        // so none of them is edge-on and invisible.
        if (Math.abs(z + 8.0) <= 1.5) {
            double rr = Math.sqrt((double) x * x + (y - 2.0) * (y - 2.0));
            if (rr <= 2.0) {
                return Blocks.OAK_LOG;
            }
            if (rr <= 14.0) {
                double a = Math.atan2(y - 2.0, x);
                for (int k = 0; k < 4; k++) {
                    double want = Math.PI / 4.0 + k * Math.PI / 2.0;
                    double off = Math.abs(Math.atan2(Math.sin(a - want), Math.cos(a - want)));
                    if (off <= 0.16) {
                        return Blocks.OAK_LOG;
                    }
                    if (off <= 0.42 && rr > 4.0) {
                        return Blocks.WHITE_WOOL;
                    }
                }
            }
        }
        return null;
    }
}
