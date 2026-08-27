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

/** A winner's cup, for when subtlety is not required. */
public class GiantTrophyItem extends ArsenalItem {
    private static final int REACH = 12;
    private static final int HEIGHT = 85;
    private static final int CRATER = 16;
    private static final int DEPTH = 7;
    private static final int COOLDOWN = 200;

    public GiantTrophyItem(Settings settings) {
        super(settings, "A winner's cup, for when subtlety is not required.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantTrophyItem::paint, REACH, HEIGHT,
                "THE TROPHY", (w, u, at) -> {
                    Sculpture.boom(w, at, 6.0F, 220);
                    w.spawnParticles(ParticleTypes.END_ROD, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        double d = Math.sqrt((double) x * x + (double) z * z);
        if (y >= 0 && y <= 9) {
            double outer = 7.0 - y * 0.15;
            if (d <= outer && d >= outer - 1.5) {
                return Blocks.GOLD_BLOCK;
            }
        }
        if (y == 0 && d <= 7.0) {
            return Blocks.GOLD_BLOCK;
        }
        if (Sculpture.post(x, z, 0, 0, 1.6) && y >= -5 && y < 0) {
            return Blocks.GOLD_BLOCK;
        }
        if (Sculpture.slab(x, y, z, -8, 8, -9, -6, -8, 8)) {
            return Blocks.OAK_LOG;
        }
        return null;
    }
}
