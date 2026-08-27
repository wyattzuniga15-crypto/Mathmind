package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
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

/** Drops an armour stand wearing your name. Mobs are drawn to it instead of you. */
public class DecoyItem extends Item {
    private static final int LIFETIME = 1200;
    private static final double PULL = 20.0;
    private static final int COOLDOWN = 200;

    public DecoyItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Entity stand = EntityType.ARMOR_STAND.create(serverWorld, SpawnReason.EVENT);
        if (stand == null) {
            return ActionResult.SUCCESS;
        }
        Vec3d ahead = user.getRotationVec(1.0F).normalize().multiply(3.0);
        stand.setPosition(user.getX() + ahead.x, user.getY(), user.getZ() + ahead.z);
        stand.setCustomName(Text.literal(user.getName().getString()));
        serverWorld.spawnEntity(stand);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_CAT_HISS,
                SoundCategory.MASTER, 2.0F, 1.0F);
        user.sendMessage(Text.literal("§7☗ It will hold their attention for a minute."), true);
        // A named armour stand is scenery: nothing in the game changes its
        // behaviour because one is standing there. So pull, every tick, anything
        // near the player toward the stand instead. That is the promise the item
        // makes, and it is one an armour stand cannot keep on its own.
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > LIFETIME || stand.isRemoved()) {
                return false;
            }
            Vec3d post = new Vec3d(stand.getX(), stand.getY(), stand.getZ());
            for (Entity thing : Area.mobs(serverWorld, user, post, PULL)) {
                double dx = post.x - thing.getX();
                double dz = post.z - thing.getZ();
                double away = Math.sqrt(dx * dx + dz * dz);
                if (away < 1.5 || away > PULL) {
                    continue;
                }
                thing.addVelocity(dx / away * 0.06, 0, dz / away * 0.06);
            }
            return true;
        });
        // Cleared on a timer, or a long session leaves a field of abandoned copies
        // of the player standing about.
        Scheduler.after(LIFETIME, () -> {
            if (!stand.isRemoved()) {
                serverWorld.spawnParticles(ParticleTypes.POOF, true, true,
                        stand.getX(), stand.getY() + 1, stand.getZ(), 30, 0.3, 0.6, 0.3, 0.02);
                stand.discard();
            }
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
