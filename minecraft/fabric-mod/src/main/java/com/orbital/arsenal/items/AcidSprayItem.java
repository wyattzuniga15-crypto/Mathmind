package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
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

/** Eats through the ground in a spreading pool that keeps sinking. */
public class AcidSprayItem extends ArsenalItem {
    private static final int RADIUS = 14;
    private static final int SINKS = 20;
    private static final int COOLDOWN = 180;

    public AcidSprayItem(Settings settings) {
        super(settings, "Eats through the ground in a spreading pool that keeps sinking.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 120.0);
        user.sendMessage(Text.literal("§a☣ ACID"), true);
        serverWorld.playSound(null, BlockPos.ofFloored(at), SoundEvents.BLOCK_GLASS_BREAK,
                SoundCategory.MASTER, 6.0F, 0.5F);
        int[] layer = {0};
        Scheduler.repeat(() -> {
            if (layer[0] >= SINKS) {
                return false;
            }
            // One layer per tick, narrowing as it goes: acid that ate a cylinder
            // would be a drill. Narrowing makes it a pool that burns through.
            double r = RADIUS * (1.0 - layer[0] / (double) SINKS * 0.6);
            Vec3d level = new Vec3d(at.x, at.y - layer[0], at.z);
            Area.column(serverWorld, level, (int) r, 0, 0,
                    (w, pos, was, dx, dy, dz) -> Blocks.AIR.getDefaultState(), null);
            serverWorld.spawnParticles(ParticleTypes.HAPPY_VILLAGER, true, true,
                    at.x, at.y - layer[0], at.z, 40, r * 0.5, 0.5, r * 0.5, 0.02);
            layer[0]++;
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
