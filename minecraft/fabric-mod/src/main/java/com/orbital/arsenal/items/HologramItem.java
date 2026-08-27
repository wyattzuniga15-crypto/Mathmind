package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Draws a glowing wireframe box in the air, so you can see a build before you make it. */
public class HologramItem extends Item {
    private static final int SIZE = 16;
    private static final int SHOWS = 1200;
    private static final int COOLDOWN = 60;

    public HologramItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d aim = user.getRotationVec(1.0F).normalize().multiply(SIZE);
        Vec3d at = new Vec3d(Math.floor(user.getX() + aim.x), Math.floor(user.getY()),
                Math.floor(user.getZ() + aim.z));
        user.sendMessage(Text.literal("§b⬚ " + SIZE + " blocks across. Nothing placed."), true);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > SHOWS) {
                return false;
            }
            if (age[0] % 4 != 0) {
                return true;
            }
            // Only the twelve edges. Filling the faces would hide whatever you are
            // trying to judge it against, which is the whole point of a guide.
            int h = SIZE / 2;
            for (int i = -h; i <= h; i++) {
                for (int a = -1; a <= 1; a += 2) {
                    for (int b = -1; b <= 1; b += 2) {
                        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                                at.x + i, at.y + h + h * a, at.z + h * b, 1, 0, 0, 0, 0);
                        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                                at.x + h * a, at.y + h + h * b, at.z + i, 1, 0, 0, 0, 0);
                        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                                at.x + h * a, at.y + h + i, at.z + h * b, 1, 0, 0, 0, 0);
                    }
                }
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
