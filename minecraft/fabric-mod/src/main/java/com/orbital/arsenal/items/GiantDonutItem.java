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

/** A doughnut. A torus, if you want to be formal about it. */
public class GiantDonutItem extends Item {
    private static final int REACH = 14;
    private static final int HEIGHT = 80;
    private static final int CRATER = 18;
    private static final int DEPTH = 6;
    private static final int COOLDOWN = 200;

    public GiantDonutItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantDonutItem::paint, REACH, HEIGHT,
                "THE DOUGHNUT", (w, u, at) -> {
                    Sculpture.boom(w, at, 5.0F, 220);
                    w.spawnParticles(ParticleTypes.HAPPY_VILLAGER, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        // A torus: distance from a circle of radius eight, rather than from a
        // point. Four blocks of dough around it, iced on top.
        double ring = Math.sqrt((double) x * x + (double) z * z) - 8.0;
        if (ring * ring + (double) y * y <= 16.0) {
            return y > 1 ? Blocks.PINK_CONCRETE : Blocks.BROWN_CONCRETE;
        }
        return null;
    }
}
