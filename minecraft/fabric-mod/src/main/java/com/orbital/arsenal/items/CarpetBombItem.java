package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Shells;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** A line of explosions walking away from you along your line of sight. */
public class CarpetBombItem extends ArsenalItem {
    private static final int RUNS = 30;
    private static final int COOLDOWN = 250;

    public CarpetBombItem(Settings settings) {
        super(settings, "A line of explosions walking away from you along your line of sight.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        double flat = Math.sqrt(aim.x * aim.x + aim.z * aim.z);
        if (flat < 0.05) {
            user.sendMessage(Text.literal("§7Look along the ground first."), true);
            return ActionResult.SUCCESS;
        }
        double ux = aim.x / flat;
        double uz = aim.z / flat;
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_GENERIC_EXPLODE.value(),
                SoundCategory.MASTER, 6.0F, 0.8F);
        user.sendMessage(Text.literal("§c▬▬ Carpet"), true);
        int[] step = {0};
        Scheduler.repeat(() -> {
            // The run walks out from wherever the player is standing; with no player it
            // walks out from a corpse.
            if (step[0] >= RUNS || user.isRemoved()) {
                return false;
            }
            // One pair a tick, walking outward. Dropped all at once it is a very
            // wide crater; walked, it reads as a bombing run.
            double along = 12.0 + step[0] * 7.0;
            for (int side = -1; side <= 1; side += 2) {
                Shells.drop(serverWorld,
                        user.getX() + ux * along + -uz * side * 5.0,
                        user.getY() + 60,
                        user.getZ() + uz * along + ux * side * 5.0);
            }
            step[0]++;
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
