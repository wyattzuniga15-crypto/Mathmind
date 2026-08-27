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

/** A war hammer the size of a house, head first. */
public class GiantHammerItem extends ArsenalItem {
    private static final int REACH = 16;
    private static final int HEIGHT = 100;
    private static final int CRATER = 24;
    private static final int DEPTH = 20;
    private static final int COOLDOWN = 200;

    public GiantHammerItem(Settings settings) {
        super(settings, "A war hammer the size of a house, head first.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantHammerItem::paint, REACH, HEIGHT,
                "THE HAMMER", (w, u, at) -> {
                    Sculpture.boom(w, at, 11.0F, 220);
                    w.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (Sculpture.slab(x, y, z, -8, 8, 6, 14, -6, 6)) {
            return Blocks.IRON_BLOCK;
        }
        if (Sculpture.post(x, z, 0, 0, 2.2) && y >= -14 && y < 6) {
            return Blocks.OAK_LOG;
        }
        return null;
    }
}
