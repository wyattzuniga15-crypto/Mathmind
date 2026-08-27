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

/** A three-tier birthday cake, with a candle, delivered from orbit. */
public class GiantCakeItem extends Item {
    public GiantCakeItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantCakeItem::paint, 24, 110,
                "BIRTHDAY CAKE", (w, u, at) -> {
                    Sculpture.boom(w, at, 5.0F, 200);
                    w.spawnParticles(ParticleTypes.HAPPY_VILLAGER, true, true,
                            at.x, at.y + 5, at.z, 400, 12.0, 6.0, 12.0, 0.1);
                    Sculpture.crater(w, at, 20, 6, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), 200);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        // Three tiers, each six tall so they meet: five-block gaps between
        // them read as three separate cakes falling in formation.
        int[] bases = {0, 6, 12};
        double[] radii = {9.0, 6.5, 4.0};
        for (int i = 0; i < bases.length; i++) {
            if (Sculpture.post(x, z, 0, 0, radii[i]) && y >= bases[i] && y < bases[i] + 6) {
                int up = y - bases[i];
                if (up >= 5) {
                    return Blocks.WHITE_CONCRETE;
                }
                return up == 0 ? Blocks.RED_CONCRETE : Blocks.YELLOW_TERRACOTTA;
            }
        }
        if (Sculpture.post(x, z, 0, 0, 1.0) && y >= 18 && y <= 21) {
            return Blocks.WHITE_CONCRETE;
        }
        if (Sculpture.ball(x, y, z, 0, 22.5, 0, 1.4)) {
            return Blocks.GLOWSTONE;
        }
        return null;
    }
}
