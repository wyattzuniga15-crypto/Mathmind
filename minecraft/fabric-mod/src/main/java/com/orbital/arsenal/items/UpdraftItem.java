package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.entity.Entity;
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

/** A column of rising air. Step in and go up; step out and do not. */
public class UpdraftItem extends ArsenalItem {
    private static final double RADIUS = 5.0;
    private static final int HEIGHT = 60;
    private static final int DURATION = 600;
    private static final double TOP_SPEED = 0.9;
    private static final int COOLDOWN = 200;

    public UpdraftItem(Settings settings) {
        super(settings, "A column of rising air. Step in and go up; step out and do not.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 60.0);
        double baseY = at.y;
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 1.2F, 1.4F);
        user.sendMessage(Text.literal("§f↑ Updraft. Thirty seconds."), true);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION) {
                return false;
            }
            if (age[0] % 3 == 0) {
                for (int y = 0; y < HEIGHT; y += 4) {
                    serverWorld.spawnParticles(ParticleTypes.CLOUD, true, true,
                            at.x, baseY + y, at.z, 3, RADIUS * 0.5, 0.4, RADIUS * 0.5, 0.04);
                }
            }
            // Every other tick. Nothing moves far enough in one tick to need a
            // hundred-and-twenty-block entity query six hundred times over.
            if (age[0] % 2 != 0) {
                return true;
            }
            Vec3d middle = new Vec3d(at.x, baseY + HEIGHT / 2.0, at.z);
            for (Entity thing : Area.living(serverWorld, null, middle, HEIGHT)) {
                double dx = thing.getX() - at.x;
                double dz = thing.getZ() - at.z;
                if (dx * dx + dz * dz > RADIUS * RADIUS) {
                    continue;
                }
                double up = thing.getY() - baseY;
                if (up < 0 || up > HEIGHT) {
                    continue;
                }
                // Accelerate toward a ceiling speed rather than adding lift every
                // tick. Unbounded lift fires anything that wanders in into orbit.
                Vec3d v = thing.getVelocity();
                if (v.y < TOP_SPEED) {
                    thing.setVelocity(new Vec3d(v.x, Math.min(TOP_SPEED, v.y + 0.14), v.z));
                }
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
