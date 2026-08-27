package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
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

/** Throws everything in a wide arc away from you, hard. Harms nothing; moves everything. */
public class SonicCannonItem extends ArsenalItem {
    private static final double REACH = 34.0;
    private static final double FORCE = 3.4;
    private static final int COOLDOWN = 60;

    public SonicCannonItem(Settings settings) {
        super(settings, "Throws everything in a wide arc away from you, hard. Harms nothing; moves everything.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        Vec3d focus = new Vec3d(user.getX(), user.getY() + 1.0, user.getZ())
                .add(aim.multiply(REACH * 0.4));
        int moved = Area.shove(serverWorld, user, focus, REACH, FORCE);
        for (int i = 0; i < 40; i++) {
            double t = i / 40.0 * REACH;
            Vec3d p = new Vec3d(user.getX(), user.getY() + 1.2, user.getZ()).add(aim.multiply(t));
            serverWorld.spawnParticles(ParticleTypes.CLOUD, true, true,
                    p.x, p.y, p.z, 6, t * 0.06, t * 0.06, t * 0.06, 0.05);
        }
        user.sendMessage(Text.literal("§f))) " + moved + " sent flying"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.PLAYERS, 5.0F, 0.9F);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
