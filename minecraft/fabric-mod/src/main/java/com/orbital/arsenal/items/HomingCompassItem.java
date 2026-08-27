package com.orbital.arsenal.items;

import java.util.HashMap;
import java.util.Map;
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

/** Points the way back to where you last used it, and tells you how far. */
public class HomingCompassItem extends Item {
    /** Where each player set their marker. */
    // Keyed by UUID rather than by the player object. A PlayerEntity is
    // replaced on every respawn and every dimension change, so an
    // identity-keyed map silently loses the entry the moment you die — and
    // because nothing removes entries on disconnect, it also holds the old
    // entity, and through it the whole world, for as long as the server runs.
    // A UUID is stable across both and holds nothing.
    private static final Map<java.util.UUID, Vec3d> HOME = new HashMap<>();
    private static final int COOLDOWN = 20;

    public HomingCompassItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d here = new Vec3d(user.getX(), user.getY(), user.getZ());
        if (user.isSneaking() || !HOME.containsKey(user.getUuid())) {
            HOME.put(user.getUuid(), here);
            user.sendMessage(Text.literal(String.format(
                    "§a✜ Marked %.0f, %.0f, %.0f", here.x, here.y, here.z)), true);
            return ActionResult.SUCCESS;
        }
        Vec3d home = HOME.get(user.getUuid());
        double dx = home.x - here.x;
        double dz = home.z - here.z;
        double away = Math.sqrt(dx * dx + dz * dz);
        // A line of particles toward the mark rather than a compass reading: a
        // bearing in degrees is useless when you cannot see your own heading.
        double len = Math.max(0.001, away);
        for (int i = 1; i <= 20; i++) {
            serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                    here.x + dx / len * i, here.y + 1.2, here.z + dz / len * i,
                    1, 0.0, 0.0, 0.0, 0.0);
        }
        user.sendMessage(Text.literal(String.format(
                "§b✜ %.0f blocks that way. Sneak-click to re-mark.", away)), true);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
