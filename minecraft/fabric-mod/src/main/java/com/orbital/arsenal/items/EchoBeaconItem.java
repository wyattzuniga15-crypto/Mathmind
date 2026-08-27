package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.echo.Echoes;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.Set;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

/**
 * Switch it on and a new echo joins you every minute, unattended.
 *
 * The same ghosts as the Echo Ghost, raised on a timer rather than by hand —
 * leave it running and you slowly acquire a crowd, each one replaying whatever
 * you happened to be doing when its minute came round. Right-click again to
 * switch it off.
 */
public class EchoBeaconItem extends ArsenalItem {
    private static final int INTERVAL = 1200; // 60 seconds
    private static final int COOLDOWN = 40;

    /**
     * Who has it running. Identity is all this needs, and an entry is dropped
     * the moment its player is gone.
     */
    // Keyed by UUID: a ServerPlayerEntity is replaced on respawn and on every
    // dimension change, so an entity-keyed map loses the entry when the player
    // dies, and holds the dead entity — and the world behind it — for the life
    // of the server.
    private static final Set<java.util.UUID> RUNNING = new java.util.HashSet<>();

    public EchoBeaconItem(Settings settings) {
        super(settings, "Switch it on and a new echo joins you every minute, unattended.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld) || !(user instanceof ServerPlayerEntity player)) {
            return ActionResult.SUCCESS;
        }

        if (RUNNING.remove(player.getUuid())) {
            player.sendMessage(Text.literal("§7◉ beacon off"), true);
            return ActionResult.SUCCESS;
        }

        RUNNING.add(player.getUuid());
        player.sendMessage(Text.literal("§5◉ ECHO BEACON — a new echo every 60s"), true);
        serverWorld.playSound(null, player.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 2.0F, 0.9F);
        pulse(player, serverWorld);

        ItemStack stack = player.getStackInHand(hand);
        player.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static void pulse(ServerPlayerEntity player, ServerWorld world) {
        Scheduler.after(INTERVAL, () -> {
            // Both checks matter: switching the beacon off leaves this timer
            // already scheduled, and a player who logged out must not keep a
            // ghost factory running in an empty world.
            if (!RUNNING.contains(player.getUuid()) || player.isRemoved()) {
                RUNNING.remove(player.getUuid());
                return;
            }
            int total = Echoes.spawn(player);
            if (total > 0) {
                player.sendMessage(Text.literal("§d◈ a new echo joins you — " + total + " walking"), true);
                world.spawnParticles(ParticleTypes.SOUL_FIRE_FLAME,
                        player.getX(), player.getY() + 1.0, player.getZ(), 30, 0.8, 1.2, 0.8, 0.01);
            }
            pulse(player, world);
        });
    }
}
