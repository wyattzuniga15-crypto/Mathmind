package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LivingEntity;
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

/** A bolt that jumps from target to target, up to twelve times. */
public class ChainLightningItem extends Item {
    private static final int JUMPS = 12;
    private static final double HOP = 18.0;
    private static final int COOLDOWN = 120;

    public ChainLightningItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        java.util.Set<Entity> struck = new java.util.HashSet<>();
        Vec3d[] from = {new Vec3d(user.getX(), user.getY(), user.getZ())};
        int[] jumps = {0};
        Scheduler.repeat(() -> {
            if (jumps[0]++ >= JUMPS) {
                return false;
            }
            // Nearest unstruck target each hop, so the bolt walks the crowd instead
            // of bouncing between the same two things forever.
            Entity next = null;
            double best = Double.MAX_VALUE;
            for (Entity thing : Area.living(serverWorld, user, from[0], HOP)) {
                if (!(thing instanceof LivingEntity) || struck.contains(thing)) {
                    continue;
                }
                double d = thing.getX() - from[0].x;
                double e = thing.getZ() - from[0].z;
                double dist = d * d + e * e;
                if (dist < best) {
                    best = dist;
                    next = thing;
                }
            }
            if (next == null) {
                return false;
            }
            struck.add(next);
            Entity bolt = EntityType.LIGHTNING_BOLT.create(serverWorld, SpawnReason.EVENT);
            if (bolt != null) {
                bolt.setPosition(next.getX(), next.getY(), next.getZ());
                serverWorld.spawnEntity(bolt);
            }
            from[0] = new Vec3d(next.getX(), next.getY(), next.getZ());
            return true;
        });
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_GENERIC_EXPLODE.value(),
                SoundCategory.MASTER, 4.0F, 1.2F);
        user.sendMessage(Text.literal("§e⚡⚡ Chain"), true);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
