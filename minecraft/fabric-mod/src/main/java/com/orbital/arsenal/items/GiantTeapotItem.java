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

/** The Utah teapot, at last rendered in dirt and ruin. */
public class GiantTeapotItem extends Item {
    private static final int REACH = 14;
    private static final int HEIGHT = 85;
    private static final int CRATER = 18;
    private static final int DEPTH = 7;
    private static final int COOLDOWN = 200;

    public GiantTeapotItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantTeapotItem::paint, REACH, HEIGHT,
                "THE TEAPOT", (w, u, at) -> {
                    Sculpture.boom(w, at, 6.0F, 220);
                    w.spawnParticles(ParticleTypes.CLOUD, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (y >= -4 && Sculpture.blob(x, y, z, 0, 0, 0, 8, 6, 8)) {
            return Blocks.WHITE_CONCRETE;
        }
        if (y > 6 && Sculpture.post(x, z, 0, 0, 2.5 - (y - 6) * 0.3)) {
            return Blocks.WHITE_CONCRETE;
        }
        // Spout and handle are arcs — a ring in the XY plane, thin in Z.
        if (Math.abs(z) <= 2 && x > 4) {
            double d = Math.sqrt((x - 9.0) * (x - 9.0) + (y - 1.0) * (y - 1.0));
            if (d >= 2.0 && d <= 4.0) {
                return Blocks.WHITE_CONCRETE;
            }
        }
        if (Math.abs(z) <= 1) {
            double d = Math.sqrt((x + 9.0) * (x + 9.0) + (y - 1.0) * (y - 1.0));
            if (d >= 2.5 && d <= 4.5) {
                return Blocks.WHITE_CONCRETE;
            }
        }
        return null;
    }
}
