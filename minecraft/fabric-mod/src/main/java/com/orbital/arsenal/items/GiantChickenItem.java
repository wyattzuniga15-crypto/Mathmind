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

/** Drops an enormous chicken. It does not survive the landing. */
public class GiantChickenItem extends ArsenalItem {
    private static final int REACH = 12;
    private static final int HEIGHT = 85;
    private static final int CRATER = 24;
    private static final int DEPTH = 8;
    private static final int COOLDOWN = 200;

    public GiantChickenItem(Settings settings) {
        super(settings, "Drops an enormous chicken. It does not survive the landing.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantChickenItem::paint, REACH, HEIGHT,
                "GIANT CHICKEN", (w, u, at) -> {
                    Sculpture.boom(w, at, 7.0F, 220);
                    w.spawnParticles(ParticleTypes.HAPPY_VILLAGER, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (Sculpture.blob(x, y, z, 0, 0, 0, 6, 5, 4)) {
            return Blocks.WHITE_CONCRETE;
        }
        if (Sculpture.ball(x, y, z, 5, 6, 0, 3.0)) {
            // Eyes before the head, or the white would swallow them.
            if (Sculpture.ball(x, y, z, 7.4, 6.8, 1.3, 0.7)
                    || Sculpture.ball(x, y, z, 7.4, 6.8, -1.3, 0.7)) {
                return Blocks.BLACK_CONCRETE;
            }
            return Blocks.WHITE_CONCRETE;
        }
        if (Sculpture.blob(x, y, z, 8.4, 5.4, 0, 2.0, 1.0, 1.2)) {
            return Blocks.ORANGE_CONCRETE;
        }
        if (Sculpture.ball(x, y, z, 4.6, 9.2, 0, 1.6)) {
            return Blocks.RED_CONCRETE;
        }
        for (int lz = -1; lz <= 1; lz += 2) {
            if (Math.abs(x - 1) <= 1 && Math.abs(z - lz * 2) <= 1 && y >= -9 && y < -5) {
                return Blocks.ORANGE_CONCRETE;
            }
        }
        if (Sculpture.blob(x, y, z, -6.5, 2, 0, 2.5, 3.0, 1.2)) {
            return Blocks.WHITE_CONCRETE;
        }
        return null;
    }
}
