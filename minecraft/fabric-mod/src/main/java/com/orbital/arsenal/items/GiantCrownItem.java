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

/** A king's crown, twenty blocks across, dropped from orbit. */
public class GiantCrownItem extends Item {
    private static final int REACH = 12;
    private static final int HEIGHT = 90;
    private static final int CRATER = 18;
    private static final int DEPTH = 8;
    private static final int COOLDOWN = 200;

    public GiantCrownItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantCrownItem::paint, REACH, HEIGHT,
                "THE CROWN", (w, u, at) -> {
                    Sculpture.boom(w, at, 7.0F, 220);
                    w.spawnParticles(ParticleTypes.END_ROD, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        double d = Math.sqrt((double) x * x + (double) z * z);
        boolean onBand = d >= 8.0 && d <= 10.0;
        if (y >= 0 && y <= 5 && onBand) {
            return Blocks.GOLD_BLOCK;
        }
        // Eight points at fixed angles, each narrowing as it rises. Testing a
        // parity condition on the angle instead made the whole crown render as
        // two solid bars, because the test was true on both sides at once.
        if (y > 5 && y <= 15 && onBand) {
            double a = Math.atan2(z, x);
            for (int k = 0; k < 8; k++) {
                double want = k * Math.PI / 4.0;
                double off = Math.abs(Math.atan2(Math.sin(a - want), Math.cos(a - want)));
                if (off <= 0.30 * (1.0 - (y - 5) / 10.0)) {
                    return y > 12 ? Blocks.DIAMOND_BLOCK : Blocks.GOLD_BLOCK;
                }
            }
        }
        return null;
    }
}
