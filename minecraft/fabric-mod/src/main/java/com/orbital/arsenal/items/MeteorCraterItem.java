package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** An old crater, weathered in — rim, bowl, and a molten core. */
public class MeteorCraterItem extends ArsenalItem {
    private static final int RADIUS = 38;
    private static final int DEPTH = 20;
    private static final int COOLDOWN = 300;

    public MeteorCraterItem(Settings settings) {
        super(settings, "An old crater, weathered in — rim, bowl, and a molten core.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 140.0);
        user.sendMessage(Text.literal("§6◍ Impact site."), true);
        Strikes.blast(serverWorld, at.add(0, 2, 0), 12.0F);
        Area.column(serverWorld, at, RADIUS + 6, 30, DEPTH + 6, (w, pos, was, dx, dy, dz) -> {
            double d = Math.sqrt((double) dx * dx + (double) dz * dz);
            // A raised rim outside the bowl, which is what makes it read as an
            // impact rather than a quarry.
            if (d > RADIUS) {
                double lip = 5.0 * (1.0 - (d - RADIUS) / 6.0);
                if (dy >= 0 && dy <= lip && was.isAir()) {
                    return Blocks.STONE.getDefaultState();
                }
                return null;
            }
            double bowl = -DEPTH * Math.sqrt(1.0 - (d / RADIUS) * (d / RADIUS));
            if (dy > bowl) {
                return was.isAir() ? null : Blocks.AIR.getDefaultState();
            }
            if (dy > bowl - 2 && d < RADIUS * 0.25) {
                return Blocks.MAGMA_BLOCK.getDefaultState();
            }
            return null;
        }, () -> user.sendMessage(Text.literal("§6◍ " + RADIUS * 2 + " blocks across."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
