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

/** Drops a hot air balloon, basket and all. It does not stay up. */
public class GiantHotAirBalloonItem extends ArsenalItem {
    private static final int REACH = 16;
    private static final int HEIGHT = 110;
    private static final int CRATER = 14;
    private static final int DEPTH = 6;
    private static final int COOLDOWN = 200;

    public GiantHotAirBalloonItem(Settings settings) {
        super(settings, "Drops a hot air balloon, basket and all. It does not stay up.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantHotAirBalloonItem::paint, REACH, HEIGHT,
                "THE BALLOON", (w, u, at) -> {
                    Sculpture.boom(w, at, 6.0F, 220);
                    w.spawnParticles(ParticleTypes.CLOUD, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        // The envelope: a teardrop in four coloured gores, hollow, pinched at the
        // bottom where the ropes meet it.
        if (y >= 2 && y <= 18) {
            double t = (y - 2) / 16.0;
            double r = 11.0 * Math.sin(Math.PI * (0.18 + 0.72 * t));
            double d = Math.sqrt((double) x * x + (double) z * z);
            if (d >= r - 1.5 && d <= r) {
                int gore = (int) ((Math.atan2(z, x) + Math.PI) / (Math.PI / 2.0)) % 4;
                switch (gore) {
                    case 0: return Blocks.RED_CONCRETE;
                    case 1: return Blocks.WHITE_CONCRETE;
                    case 2: return Blocks.YELLOW_CONCRETE;
                    default: return Blocks.BLUE_CONCRETE;
                }
            }
        }
        // Four ropes down to the basket.
        if ((Math.abs(x) == 4 && Math.abs(z) == 4) && y >= -6 && y < 2) {
            return Blocks.OAK_LOG;
        }
        if (y >= -12 && y <= -6 && Math.max(Math.abs(x), Math.abs(z)) <= 5
                && (y == -12 || Math.max(Math.abs(x), Math.abs(z)) >= 4)) {
            return Blocks.OAK_LOG;
        }
        return null;
    }
}
