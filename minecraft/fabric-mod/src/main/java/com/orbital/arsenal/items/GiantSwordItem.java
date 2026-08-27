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

/** A sword driven into the ground point first. */
public class GiantSwordItem extends Item {
    private static final int REACH = 22;
    private static final int HEIGHT = 110;
    private static final int CRATER = 14;
    private static final int DEPTH = 26;
    private static final int COOLDOWN = 200;

    public GiantSwordItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantSwordItem::paint, REACH, HEIGHT,
                "THE SWORD", (w, u, at) -> {
                    Sculpture.boom(w, at, 9.0F, 220);
                    w.spawnParticles(ParticleTypes.END_ROD, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (Sculpture.post(x, z, 0, 0, 1.6) && y >= -20 && y < -12) {
            return Blocks.OAK_LOG;
        }
        if (Sculpture.slab(x, y, z, -5, 5, -12, -10, -2, 2)) {
            return Blocks.GOLD_BLOCK;
        }
        // The blade narrows smoothly to a point rather than in steps.
        if (y >= -10 && y <= 20 && Math.abs(z) <= 1) {
            double width = 3.0 * (1.0 - Math.max(0.0, y - 8.0) / 12.0);
            if (width > 0 && Math.abs(x) <= width) {
                return Blocks.IRON_BLOCK;
            }
        }
        return null;
    }
}
