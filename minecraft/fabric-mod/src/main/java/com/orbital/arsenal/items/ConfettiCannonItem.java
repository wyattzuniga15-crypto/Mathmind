package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import java.util.concurrent.ThreadLocalRandom;
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

/** Fires a great burst of confetti. Purely decorative, and that is the point. */
public class ConfettiCannonItem extends Item {
    private static final int PUFFS = 40;
    private static final int COOLDOWN = 60;

    public ConfettiCannonItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        user.sendMessage(Text.literal("§d✿ Confetti!"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_GENERIC_EXPLODE.value(),
                SoundCategory.PLAYERS, 1.5F, 2.0F);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > PUFFS) {
                return false;
            }
            // Sprayed over two seconds rather than all at once: one frame of
            // particles is a flash, a stream of them is confetti falling.
            Vec3d from = new Vec3d(user.getX(), user.getY() + 1.4, user.getZ())
                    .add(aim.multiply(1.5 + age[0] * 0.25));
            serverWorld.spawnParticles(ParticleTypes.HAPPY_VILLAGER, true, true,
                    from.x, from.y, from.z, 12, 1.2, 1.2, 1.2, 0.12);
            serverWorld.spawnParticles(ParticleTypes.CRIT, true, true,
                    from.x, from.y, from.z, 8, 1.0, 1.0, 1.0, 0.1);
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
