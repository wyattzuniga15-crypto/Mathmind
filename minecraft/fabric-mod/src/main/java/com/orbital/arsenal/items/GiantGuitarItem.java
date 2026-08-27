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

/** Drops a guitar the size of a barn. It is not in tune. */
public class GiantGuitarItem extends Item {
    private static final int REACH = 16;
    private static final int HEIGHT = 90;
    private static final int CRATER = 16;
    private static final int DEPTH = 6;
    private static final int COOLDOWN = 200;

    public GiantGuitarItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantGuitarItem::paint, REACH, HEIGHT,
                "THE GUITAR", (w, u, at) -> {
                    Sculpture.boom(w, at, 6.0F, 220);
                    w.spawnParticles(ParticleTypes.NOTE, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        // Lying face up: the body is a plate in the XZ plane, the neck runs out
        // along +x. Waist and bouts come from one radius that varies with x —
        // two overlapping discs left a notch where they met.
        if (x >= -16 && x <= -2 && Math.abs(y) <= 2) {
            double t = (x + 16) / 14.0;
            double wide = 7.0 - 3.4 * Math.exp(-((t - 0.52) * (t - 0.52)) / 0.012);
            if (Math.abs(z) <= wide) {
                // Hollow, so the sound hole opens into something rather than
                // denting a solid plank.
                if (Math.abs(y) <= 1 && Math.abs(z) <= wide - 2 && x >= -14 && x <= -4) {
                    return null;
                }
                if (y == 2 && (x + 6) * (x + 6) + z * z <= 9) {
                    return null;
                }
                return Blocks.SPRUCE_PLANKS;
            }
        }
        if (x > -2 && x <= 15 && Math.abs(z) <= 1.6 && y >= -1 && y <= 1) {
            return Blocks.DARK_OAK_PLANKS;
        }
        if (x > 15 && x <= 18 && Math.abs(z) <= 2.6 && y >= -1 && y <= 1) {
            return Blocks.DARK_OAK_PLANKS;
        }
        if (x >= -1 && x <= 17 && y == 2 && Math.abs(z) <= 1) {
            return Blocks.IRON_BLOCK;
        }
        return null;
    }
}
