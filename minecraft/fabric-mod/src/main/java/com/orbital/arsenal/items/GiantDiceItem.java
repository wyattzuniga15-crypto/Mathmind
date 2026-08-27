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

/** A die seventeen blocks on a side, pips and all. */
public class GiantDiceItem extends ArsenalItem {
    private static final int REACH = 10;
    private static final int HEIGHT = 80;
    private static final int CRATER = 16;
    private static final int DEPTH = 7;
    private static final int COOLDOWN = 200;

    public GiantDiceItem(Settings settings) {
        super(settings, "A die seventeen blocks on a side, pips and all.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GiantDiceItem::paint, REACH, HEIGHT,
                "THE DIE", (w, u, at) -> {
                    Sculpture.boom(w, at, 6.0F, 220);
                    w.spawnParticles(ParticleTypes.CRIT, true, true,
                            at.x, at.y + 4, at.z, 220, 9.0, 4.0, 9.0, 0.12);
                    Sculpture.crater(w, at, CRATER, DEPTH, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        // Pips only on the six faces, laid out from the two coordinates that are
        // not pinned — which is what makes them read the same on every side.
        if (Math.max(Math.abs(x), Math.max(Math.abs(y), Math.abs(z))) <= 8) {
            if (Math.abs(x) == 8 && pip(y, z)) {
                return Blocks.BLACK_CONCRETE;
            }
            if (Math.abs(y) == 8 && pip(x, z)) {
                return Blocks.BLACK_CONCRETE;
            }
            if (Math.abs(z) == 8 && pip(x, y)) {
                return Blocks.BLACK_CONCRETE;
            }
            return Blocks.WHITE_CONCRETE;
        }
        return null;
    }

    /** Two pips on a face, on opposite corners plus a centre. */
    private static boolean pip(int a, int b) {
        if (a * a + b * b <= 4) {
            return true;
        }
        return (Math.abs(a - 4) <= 2 && Math.abs(b - 4) <= 2)
                || (Math.abs(a + 4) <= 2 && Math.abs(b + 4) <= 2);
    }
}
