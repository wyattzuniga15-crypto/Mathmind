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

/** A bell, which rings once, very loudly. */
public class GiantBellItem extends Item {
    private static final int REACH = 14;
    private static final int HEIGHT = 90;
    private static final int CRATER = 18;
    private static final int DEPTH = 10;
    private static final int COOLDOWN = 200;

    public GiantBellItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantBellItem::paint, REACH, HEIGHT,
                "THE BELL", (w, u, at) -> {
                    Sculpture.boom(w, at, 8.0F, 220);
                    w.spawnParticles(ParticleTypes.NOTE, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        // A bell is a flared shell: the wall stays two thick while the radius
        // grows toward the rim, which a solid cone would not do.
        if (y >= -12 && y <= 6) {
            double t = (y + 12) / 22.0;
            double outer = 3.0 + 7.0 * Math.pow(1.0 - t, 1.4);
            double d = Math.sqrt((double) x * x + (double) z * z);
            if (d <= outer && d >= outer - 2.0) {
                return Blocks.GOLD_BLOCK;
            }
            if (y == -12 && d <= outer) {
                return Blocks.GOLD_BLOCK;
            }
        }
        if (Sculpture.post(x, z, 0, 0, 1.2) && y > 6 && y <= 12) {
            return Blocks.OAK_LOG;
        }
        return null;
    }
}
