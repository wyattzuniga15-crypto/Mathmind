package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Sculpture;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Drops a colossal anvil. It is very heavy, and the hole says so. */
public class GiantAnvilItem extends ArsenalItem {
    public GiantAnvilItem(Settings settings) {
        super(settings, "Drops a colossal anvil. It is very heavy, and the hole says so.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantAnvilItem::paint, 14, 100,
                "ANVIL", (w, u, at) -> {
                    Sculpture.boom(w, at, 12.0F, 300);
                    // Narrow and deep rather than wide: an anvil punches.
                    Sculpture.crater(w, at, 20, 30, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), 200);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        if (Sculpture.slab(x, y, z, -7, 7, 4, 7, -4, 4)) {
            return Blocks.IRON_BLOCK;
        }
        if (Sculpture.slab(x, y, z, -4, 4, 0, 3, -3, 3)) {
            return Blocks.IRON_BLOCK;
        }
        if (Sculpture.slab(x, y, z, -6, 6, -4, -1, -4, 4)) {
            return Blocks.IRON_BLOCK;
        }
        if (Sculpture.blob(x, y, z, 10, 6, 0, 4, 1.6, 1.6)) {
            return Blocks.IRON_BLOCK;
        }
        return null;
    }
}
