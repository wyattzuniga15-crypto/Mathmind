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

/** A mushroom twenty-three blocks across. */
public class GiantMushroomItem extends Item {
    private static final int REACH = 12;
    private static final int HEIGHT = 80;
    private static final int CRATER = 20;
    private static final int DEPTH = 6;
    private static final int COOLDOWN = 200;

    public GiantMushroomItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantMushroomItem::paint, REACH, HEIGHT,
                "GIANT MUSHROOM", (w, u, at) -> {
                    Sculpture.boom(w, at, 5.0F, 220);
                    w.spawnParticles(ParticleTypes.HAPPY_VILLAGER, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (y >= 0 && y <= 8 && Sculpture.blob(x, y, z, 0, 0, 0, 11, 9, 11)) {
            return y > 2 ? Blocks.RED_CONCRETE : Blocks.WHITE_CONCRETE;
        }
        if (Sculpture.post(x, z, 0, 0, 3.0) && y >= -10 && y < 1) {
            return Blocks.WHITE_CONCRETE;
        }
        return null;
    }
}
