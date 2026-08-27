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

/** A ship's anchor, arriving point first. It will not be moved again. */
public class GiantAnchorItem extends Item {
    private static final int REACH = 14;
    private static final int HEIGHT = 105;
    private static final int CRATER = 16;
    private static final int DEPTH = 24;
    private static final int COOLDOWN = 200;

    public GiantAnchorItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantAnchorItem::paint, REACH, HEIGHT,
                "THE ANCHOR", (w, u, at) -> {
                    Sculpture.boom(w, at, 10.0F, 220);
                    w.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (Sculpture.post(x, z, 0, 0, 1.6) && y >= -8 && y <= 14) {
            return Blocks.IRON_BLOCK;
        }
        if (Math.abs(z) <= 1.6 && Math.abs(y - 11) <= 1.6 && Math.abs(x) <= 8) {
            return Blocks.IRON_BLOCK;
        }
        // The arms are an annulus in the XZ-plane, thin in Z — a curve rather
        // than two straight struts, which is what makes it read as an anchor.
        double arm = Math.sqrt((double) x * x + (y + 8.0) * (y + 8.0));
        if (arm >= 9.0 && arm <= 11.0 && y < -2 && Math.abs(z) <= 1.6) {
            return Blocks.IRON_BLOCK;
        }
        return null;
    }
}
