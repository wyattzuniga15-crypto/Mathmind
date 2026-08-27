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

/** A gramophone the size of a barn, horn first. */
public class GiantGramophoneItem extends Item {
    private static final int REACH = 16;
    private static final int HEIGHT = 95;
    private static final int CRATER = 18;
    private static final int DEPTH = 9;
    private static final int COOLDOWN = 200;

    public GiantGramophoneItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantGramophoneItem::paint, REACH, HEIGHT,
                "THE GRAMOPHONE", (w, u, at) -> {
                    Sculpture.boom(w, at, 7.0F, 220);
                    w.spawnParticles(ParticleTypes.NOTE, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (Sculpture.slab(x, y, z, -8, 8, -6, -3, -8, 8)) {
            return Blocks.OAK_LOG;
        }
        if (Sculpture.post(x, z, 0, 0, 1.0) && y > -3 && y <= 6) {
            return Blocks.IRON_BLOCK;
        }
        // The horn is swept as a ring of samples along a widening cone, which is
        // far easier to get right than a closed-form flare.
        for (int t = 0; t <= 12; t++) {
            double f = t / 12.0;
            double hx = 9.0 * f;
            double hy = 6.0 + 8.0 * f;
            double r = 1.0 + 6.0 * f;
            if (Math.abs(y - hy) <= 1
                    && Math.abs(Math.sqrt((x - hx) * (x - hx) + (double) z * z) - r) <= 1.2) {
                return Blocks.GOLD_BLOCK;
            }
        }
        return null;
    }
}
