package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Formation;
import com.orbital.arsenal.weapons.Strikes;
import java.util.List;
import net.minecraft.entity.TntEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** A ring of TNT dropped from the sky, landing before it detonates. */
public class StrikeCannonItem extends Item {
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
    private static final int FUSE = 80;

    public StrikeCannonItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Vec3d target = Strikes.aim(user, 150.0);
        List<Formation.Offset> formation = Formation.rings(SHELLS, RADIUS, RINGS);

        user.sendMessage(Text.literal("\u00a7c\u2604 ORBITAL STRIKE \u2014 " + SHELLS + " shells"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 4.0F, 0.6F);

        // Spread the spawns over a few ticks. All at once is a visible hitch,
        // and the fall is long enough that the delay never shows.
        int[] spawned = {0};
        Scheduler.repeat(() -> {
            for (int i = 0; i < PER_TICK && spawned[0] < formation.size(); i++, spawned[0]++) {
                Formation.Offset offset = formation.get(spawned[0]);
                TntEntity tnt = new TntEntity(serverWorld,
                        target.x + offset.x(), target.y + DROP_HEIGHT, target.z + offset.z(), null);
                // The fuse outlasts the fall on purpose, so the volley lands
                // before any of it goes off instead of airbursting on the way.
                tnt.setFuse(FUSE);
                serverWorld.spawnEntity(tnt);
            }
            return spawned[0] < formation.size();
        });

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
