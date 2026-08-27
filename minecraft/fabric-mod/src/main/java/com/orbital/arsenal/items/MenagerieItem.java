package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.entity.ModEntities;
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

/** Calls up one of each of the mod's eight creatures. They will not get along. */
public class MenagerieItem extends Item {
    private static final double RING = 18.0;
    private static final int COOLDOWN = 600;

    public MenagerieItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        user.sendMessage(Text.literal("§d✦ All eight. Run."), true);
        // One a second, spaced around a ring, rather than eight at once in one
        // place — the game resolves eight overlapping large mobs by flinging them.
        int[] which = {0};
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] % 20 != 0) {
                return true;
            }
            // Eight large mobs placed around a player who has left is eight large mobs
            // standing in an empty field.
            if (which[0] >= 8 || user.isRemoved()) {
                return false;
            }
            double a = which[0] * Math.PI / 4.0;
            Entity mob = summon(serverWorld, which[0]);
            which[0]++;
            if (mob == null) {
                return true;
            }
            mob.setPosition(user.getX() + Math.cos(a) * RING, user.getY() + 1,
                    user.getZ() + Math.sin(a) * RING);
            serverWorld.spawnEntity(mob);
            serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                    mob.getX(), mob.getY() + 2, mob.getZ(), 120, 1.5, 2.0, 1.5, 0.08);
            serverWorld.playSound(null, mob.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                    SoundCategory.HOSTILE, 4.0F, 1.0F);
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static Entity summon(net.minecraft.server.world.ServerWorld world, int n) {
        switch (n) {
            case 0: return ModEntities.CHRONARCH.create(world, SpawnReason.EVENT);
            case 1: return ModEntities.SKY_WHALE.create(world, SpawnReason.EVENT);
            case 2: return ModEntities.TITAN.create(world, SpawnReason.EVENT);
            case 3: return ModEntities.DRAGON.create(world, SpawnReason.EVENT);
            case 4: return ModEntities.MECHA_SPIDER.create(world, SpawnReason.EVENT);
            case 5: return ModEntities.GOLEM.create(world, SpawnReason.EVENT);
            case 6: return ModEntities.KRAKEN.create(world, SpawnReason.EVENT);
            default: return ModEntities.PHOENIX.create(world, SpawnReason.EVENT);
        }
    }
}
