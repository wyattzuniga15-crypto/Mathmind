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

/** Drops a chess knight thirty-six blocks tall. It moves in an L, once. */
public class GiantChessKnightItem extends Item {
    private static final int REACH = 18;
    private static final int HEIGHT = 105;
    private static final int CRATER = 16;
    private static final int DEPTH = 10;
    private static final int COOLDOWN = 200;

    public GiantChessKnightItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantChessKnightItem::paint, REACH, HEIGHT,
                "KNIGHT TO E4", (w, u, at) -> {
                    Sculpture.boom(w, at, 7.0F, 220);
                    w.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        double d = Math.sqrt((double) x * x + (double) z * z);
        if (y >= -18 && y <= -13 && d <= 9.0 - (y + 18) * 0.5) {
            return Blocks.POLISHED_DEEPSLATE;
        }
        // Flat through Z: a knight is a silhouette, and one as deep as it is wide
        // reads as a lump.
        if (Math.abs(z) > 5) {
            return null;
        }
        // The neck leans forward as it rises, and narrows as it goes.
        double lean = (y + 13) * 0.30;
        if (y > -13 && y <= 5 && Math.abs(x + lean - 1.0) <= 4.0 - (y + 13) * 0.08) {
            return Blocks.POLISHED_DEEPSLATE;
        }
        // The head is shorter front to back than the neck is tall — a head as long
        // as its neck reads as a bishop.
        if (y > 5 && y <= 13 && x >= -8 && x <= 0 && Math.abs(z) <= 4) {
            return Blocks.POLISHED_DEEPSLATE;
        }
        // The muzzle juts out at head height, not at the throat.
        if (y >= 6 && y <= 11 && x >= -13 && x < -8 && Math.abs(z) <= 3) {
            return Blocks.POLISHED_DEEPSLATE;
        }
        for (int ez = -2; ez <= 2; ez += 4) {
            if (y > 13 && y <= 17 && x >= -5 && x <= -2 && Math.abs(z - ez) <= 1) {
                return Blocks.POLISHED_DEEPSLATE;
            }
        }
        return null;
    }
}
