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

/** A skull ten blocks across, grinning. */
public class GiantSkullItem extends ArsenalItem {
    private static final int REACH = 10;
    private static final int HEIGHT = 80;
    private static final int CRATER = 18;
    private static final int DEPTH = 9;
    private static final int COOLDOWN = 200;

    public GiantSkullItem(Settings settings) {
        super(settings, "A skull ten blocks across, grinning.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantSkullItem::paint, REACH, HEIGHT,
                "THE SKULL", (w, u, at) -> {
                    Sculpture.boom(w, at, 8.0F, 220);
                    w.spawnParticles(ParticleTypes.SOUL_FIRE_FLAME, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (Sculpture.ball(x, y, z, 0, 4, 0, 7.5)) {
            // Sockets and nose are holes, so they are checked first and return
            // null — a darker block would still read as a solid face.
            if (Sculpture.ball(x, y, z, 5.2, 5.4, 2.8, 2.2)
                    || Sculpture.ball(x, y, z, 5.2, 5.4, -2.8, 2.2)) {
                return null;
            }
            if (Sculpture.ball(x, y, z, 6.6, 2.0, 0, 1.4)) {
                return null;
            }
            return Blocks.BONE_BLOCK;
        }
        if (Sculpture.slab(x, y, z, -3, 6, -5, -2, -5, 5)) {
            return Blocks.BONE_BLOCK;
        }
        return null;
    }
}
