package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
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

/** A close-range cone that shreds everything in front of you. */
public class ShotgunBlastItem extends Item {
    private static final double RANGE = 18.0;
    private static final double SPREAD = 0.55;
    private static final int COOLDOWN = 30;

    public ShotgunBlastItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        Vec3d muzzle = new Vec3d(user.getX(), user.getY() + 1.5, user.getZ());
        int hit = 0;
        for (Entity thing : Area.living(serverWorld, user, muzzle.add(aim.multiply(RANGE / 2)), RANGE)) {
            Vec3d toward = new Vec3d(thing.getX() - muzzle.x, thing.getY() - muzzle.y,
                    thing.getZ() - muzzle.z);
            double d = toward.length();
            if (d > RANGE || d < 0.01) {
                continue;
            }
            // Inside the cone, measured as the angle to the aim rather than a box:
            // a box catches things beside you that you plainly did not point at.
            Vec3d unit = toward.normalize();
            if (unit.x * aim.x + unit.y * aim.y + unit.z * aim.z < 1.0 - SPREAD) {
                continue;
            }
            if (thing instanceof LivingEntity living) {
                living.kill(serverWorld);
                hit++;
            }
        }
        for (int i = 0; i < 60; i++) {
            double t = (i % 20) / 20.0 * RANGE;
            Vec3d p = muzzle.add(aim.multiply(t));
            serverWorld.spawnParticles(ParticleTypes.CRIT, true, true,
                    p.x, p.y, p.z, 2, t * 0.08, t * 0.08, t * 0.08, 0.05);
        }
        user.sendMessage(Text.literal("§7▬ " + hit + " down"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_GENERIC_EXPLODE.value(),
                SoundCategory.PLAYERS, 3.0F, 1.5F);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
