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

/** Drops an enormous golden key. It opens nothing. */
public class GiantKeyItem extends ArsenalItem {
    private static final int REACH = 14;
    private static final int HEIGHT = 90;
    private static final int CRATER = 14;
    private static final int DEPTH = 10;
    private static final int COOLDOWN = 200;

    public GiantKeyItem(Settings settings) {
        super(settings, "Drops an enormous golden key. It opens nothing.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantKeyItem::paint, REACH, HEIGHT,
                "THE KEY", (w, u, at) -> {
                    Sculpture.boom(w, at, 6.0F, 220);
                    w.spawnParticles(ParticleTypes.END_ROD, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        // Flat: a key is a silhouette, and a key three blocks thick reads as a bar.
        if (Math.abs(z) > 1) {
            return null;
        }
        double ring = Math.sqrt((double) x * x + (y - 9.0) * (y - 9.0));
        if (ring >= 4.0 && ring <= 6.5 && y > 4) {
            return Blocks.GOLD_BLOCK;
        }
        if (Math.abs(x) <= 1.5 && y >= -16 && y <= 4) {
            return Blocks.GOLD_BLOCK;
        }
        // Teeth on one side only. Symmetric teeth read as a barbell.
        if ((Math.abs(y + 9) <= 1 && x > 1.5 && x <= 5.5)
                || (Math.abs(y + 12) <= 1 && x > 1.5 && x <= 6.5)
                || (Math.abs(y + 15) <= 1 && x > 1.5 && x <= 4.5)) {
            return Blocks.GOLD_BLOCK;
        }
        return null;
    }
}
