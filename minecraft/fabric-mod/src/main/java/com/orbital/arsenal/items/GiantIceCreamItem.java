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

/** Drops a three-scoop ice cream, cherry and all. It lands cone first. */
public class GiantIceCreamItem extends ArsenalItem {
    private static final int REACH = 16;
    private static final int HEIGHT = 95;
    private static final int CRATER = 16;
    private static final int DEPTH = 6;
    private static final int COOLDOWN = 200;

    public GiantIceCreamItem(Settings settings) {
        super(settings, "Drops a three-scoop ice cream, cherry and all. It lands cone first.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantIceCreamItem::paint, REACH, HEIGHT,
                "ICE CREAM", (w, u, at) -> {
                    Sculpture.boom(w, at, 6.0F, 220);
                    w.spawnParticles(ParticleTypes.HAPPY_VILLAGER, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (y >= -18 && y < -2) {
            double d = Math.sqrt((double) x * x + (double) z * z);
            double r = 7.0 * (y + 18) / 16.0;
            if (d <= r) {
                // floorMod, not %: below the origin y is negative, and Java's
                // remainder keeps the sign, which breaks the criss-cross into
                // halves that do not line up.
                return Math.floorMod(x + y + z, 5) == 0
                        ? Blocks.BROWN_TERRACOTTA : Blocks.SMOOTH_SANDSTONE;
            }
        }
        // Three scoops, each set a little off the one below, so it leans.
        if (Sculpture.ball(x, y, z, 0, -1, 0, 7.0)) {
            return Blocks.WHITE_CONCRETE;
        }
        if (Sculpture.ball(x, y, z, 2, 7, -1, 6.0)) {
            return Blocks.PINK_CONCRETE;
        }
        if (Sculpture.ball(x, y, z, -1, 13, 2, 4.5)) {
            return Blocks.BROWN_CONCRETE;
        }
        if (Sculpture.ball(x, y, z, -1, 18, 2, 1.8)) {
            return Blocks.RED_CONCRETE;
        }
        if (x == -1 && z == 2 && y > 19 && y <= 20) {
            return Blocks.OAK_LOG;
        }
        return null;
    }
}
