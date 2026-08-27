package com.orbital.arsenal.items;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
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

/** Sneak and use to mark where you stand. Use to come back to it. */
public class RecallItem extends Item {
    // Keyed by UUID and holding no entity and no world. A map keyed by the
    // player object loses its entry on every respawn and holds the old one
    // for ever; a map holding the ServerWorld pins the world on unload.
    private static final Map<UUID, Mark> MARKS = new HashMap<>();
    private static final int COOLDOWN = 60;

    public RecallItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int here = System.identityHashCode(serverWorld);
        if (user.isSneaking()) {
            MARKS.put(user.getUuid(), new Mark(here, user.getX(), user.getY(), user.getZ()));
            user.sendMessage(Text.literal("§d✦ Marked. Use again to come back."), true);
            serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                    user.getX(), user.getY() + 1, user.getZ(), 60, 0.4, 1.0, 0.4, 0.04);
            user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
            return ActionResult.SUCCESS;
        }
        Mark mark = MARKS.get(user.getUuid());
        if (mark == null) {
            user.sendMessage(Text.literal("§7Sneak and use to set a point first."), true);
            return ActionResult.SUCCESS;
        }
        if (mark.world != here) {
            // The identity hash stands in for the world without holding it. A
            // collision would let one teleport through that should not have gone;
            // pinning a whole dimension in memory to prevent that is the worse trade.
            user.sendMessage(Text.literal("§7That mark is in another world."), true);
            return ActionResult.SUCCESS;
        }
        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                user.getX(), user.getY() + 1, user.getZ(), 60, 0.4, 1.0, 0.4, 0.04);
        user.setPosition(mark.x, mark.y, mark.z);
        serverWorld.playSound(null, BlockPos.ofFloored(mark.x, mark.y, mark.z),
                SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP, SoundCategory.MASTER, 1.0F, 1.6F);
        user.sendMessage(Text.literal("§d✦ Back."), true);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /** A place, and which world it was in, with no reference to either. */
    private record Mark(int world, double x, double y, double z) {}
}
