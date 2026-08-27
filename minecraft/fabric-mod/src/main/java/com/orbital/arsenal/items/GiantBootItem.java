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

/** A colossal boot, which lands the way a boot lands. */
public class GiantBootItem extends ArsenalItem {
    private static final int REACH = 14;
    private static final int HEIGHT = 95;
    private static final int CRATER = 22;
    private static final int DEPTH = 14;
    private static final int COOLDOWN = 200;

    public GiantBootItem(Settings settings) {
        super(settings, "A colossal boot, which lands the way a boot lands.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantBootItem::paint, REACH, HEIGHT,
                "THE BOOT", (w, u, at) -> {
                    Sculpture.boom(w, at, 9.0F, 220);
                    w.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        // The leg tapers and the toe is rounded off; a plain box reads as a box.
        double taper = 5.0 - Math.max(0, y) * 0.06;
        if (y >= -2 && y <= 12 && Math.abs(x) <= taper && Math.abs(z) <= taper) {
            return Blocks.BLACK_CONCRETE;
        }
        if (y >= -8 && y < -2 && z >= -5 && z <= 5) {
            // Ankle back to a rounded toe at the front.
            double toe = x > 4 ? Math.sqrt(Math.max(0.0, 36.0 - (x - 4) * (x - 4))) : 6.0;
            if (x >= -5 && x <= 10 && Math.abs(z) <= Math.min(5.0, toe)) {
                return Blocks.BLACK_CONCRETE;
            }
        }
        if (y >= -11 && y < -8 && x >= -6 && x <= 11 && Math.abs(z) <= 5) {
            return Blocks.BROWN_CONCRETE;
        }
        return null;
    }
}
