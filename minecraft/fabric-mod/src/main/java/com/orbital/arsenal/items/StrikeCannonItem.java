package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Formation;
import com.orbital.arsenal.weapons.Strikes;
import com.orbital.arsenal.weapons.Shells;
import java.util.List;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** A ring of TNT dropped from the sky, detonating on impact rather than on a timer. */
public class StrikeCannonItem extends ArsenalItem {
    private static final int SHELLS = 5000;
    // Radius scales with the shell count rather than staying put: 5000 shells
    // packed into the old 40-block radius would sit a third of a block apart,
    // sixteen deep in the same crater. At 100 they land ~1.6 blocks apart —
    // still heavy overlap for a blast that clears four, and 200 blocks across.
    private static final double RADIUS = 100.0;
    private static final int RINGS = 24;
    private static final int DROP_HEIGHT = 55;
    private static final int PER_TICK = 200;
    private static final int COOLDOWN = 200;

    public StrikeCannonItem(Settings settings) {
        super(settings, "A ring of TNT dropped from the sky, detonating on impact rather than on a timer.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Vec3d target = Strikes.aim(user, 150.0);
        List<Formation.Offset> formation = Formation.rings(SHELLS, RADIUS, RINGS);

        user.sendMessage(Text.literal("§c☄ ORBITAL STRIKE — " + SHELLS + " shells"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 4.0F, 0.6F);

        // Spread the spawns over a few ticks: all at once is a visible hitch,
        // and the fall is long enough that the delay never shows. Shells go off
        // on impact rather than on a fuse — see Shells for why that is the only
        // thing that works at this radius.
        int[] spawned = {0};
        Scheduler.repeat(() -> {
            for (int i = 0; i < PER_TICK && spawned[0] < formation.size(); i++, spawned[0]++) {
                Formation.Offset offset = formation.get(spawned[0]);
                Shells.drop(serverWorld,
                        target.x + offset.x(), target.y + DROP_HEIGHT, target.z + offset.z());
            }
            return spawned[0] < formation.size();
        });

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
