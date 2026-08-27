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

/** A cut gem the size of a house, dropped point-first. */
public class GiantDiamondItem extends ArsenalItem {
    public GiantDiamondItem(Settings settings) {
        super(settings, "A cut gem the size of a house, dropped point-first.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantDiamondItem::paint, 10, 85,
                "GIANT DIAMOND", (w, u, at) -> {
                    Sculpture.boom(w, at, 6.0F, 160);
                    w.spawnParticles(ParticleTypes.END_ROD, true, true,
                            at.x, at.y + 4, at.z, 300, 10.0, 6.0, 10.0, 0.15);
                    Sculpture.crater(w, at, 16, 7, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), 200);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        // An octahedron, which is what a cut gem actually is: the sum of the
        // distances along each axis, rather than the usual squares.
        if (Math.abs(x) / 7.0 + Math.abs(y) / 7.0 + Math.abs(z) / 7.0 <= 1.0) {
            // A lit core, so it glows from the inside rather than looking
            // like a pile of blue blocks.
            return (Math.abs(x) + Math.abs(y) + Math.abs(z) <= 3)
                    ? Blocks.SEA_LANTERN : Blocks.DIAMOND_BLOCK;
        }
        return null;
    }
}
