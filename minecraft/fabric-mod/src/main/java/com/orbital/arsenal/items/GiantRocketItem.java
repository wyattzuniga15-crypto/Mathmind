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

/** A rocket, arriving the wrong way up. */
public class GiantRocketItem extends Item {
    private static final int REACH = 22;
    private static final int HEIGHT = 120;
    private static final int CRATER = 22;
    private static final int DEPTH = 18;
    private static final int COOLDOWN = 200;

    public GiantRocketItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantRocketItem::paint, REACH, HEIGHT,
                "THE ROCKET", (w, u, at) -> {
                    Sculpture.boom(w, at, 12.0F, 220);
                    w.spawnParticles(ParticleTypes.FLAME, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (Sculpture.post(x, z, 0, 0, 4.0) && y >= -10 && y <= 12) {
            return Blocks.WHITE_CONCRETE;
        }
        if (y > 12 && y <= 21 && Sculpture.post(x, z, 0, 0, 4.0 * (1.0 - (y - 12) / 9.0))) {
            return Blocks.RED_CONCRETE;
        }
        // Four fins, on both axes.
        for (int s = -1; s <= 1; s += 2) {
            if (Math.abs(z - s * 5) <= 1 && Math.abs(x) <= 1 && y >= -14 && y < -6) {
                return Blocks.RED_CONCRETE;
            }
            if (Math.abs(x - s * 5) <= 1 && Math.abs(z) <= 1 && y >= -14 && y < -6) {
                return Blocks.RED_CONCRETE;
            }
        }
        return null;
    }
}
