package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Formation;
import com.orbital.arsenal.weapons.Strikes;
import java.util.ArrayList;
import java.util.Iterator;
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

/** A ring of TNT dropped from the sky, detonating on impact rather than on a timer. */
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

    // Long enough that no shell ever reaches the end of it on its own. Shells
    // are detonated by the impact watcher below, not by this.
    private static final int FUSE = 3000;
    // ...but a shell can fail to land at all — dropped over the void, or left
    // behind when its chunk unloads. Fire anything still in flight after this
    // so a volley always finishes instead of leaving live TNT lying about.
    private static final int MAX_FLIGHT = 600;

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

        user.sendMessage(Text.literal("§c☄ ORBITAL STRIKE — " + SHELLS + " shells"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 4.0F, 0.6F);

        // Shells in flight, watched for touchdown. A timed fuse cannot work
        // here: the ring is 200 blocks across, so its edges hang over whatever
        // terrain happens to be out there. A shell over a ravine or an ocean
        // falls several times as far as one over the aim point, and any single
        // fuse length that suits one of them airbursts the other.
        List<TntEntity> inFlight = new ArrayList<>();
        boolean[] spawning = {true};

        int[] spawned = {0};
        Scheduler.repeat(() -> {
            for (int i = 0; i < PER_TICK && spawned[0] < formation.size(); i++, spawned[0]++) {
                Formation.Offset offset = formation.get(spawned[0]);
                TntEntity tnt = new TntEntity(serverWorld,
                        target.x + offset.x(), target.y + DROP_HEIGHT, target.z + offset.z(), null);
                tnt.setFuse(FUSE);
                serverWorld.spawnEntity(tnt);
                inFlight.add(tnt);
            }
            if (spawned[0] < formation.size()) {
                return true;
            }
            spawning[0] = false;
            return false;
        });

        int[] age = {0};
        Scheduler.repeat(() -> {
            boolean expired = ++age[0] > MAX_FLIGHT;
            Iterator<TntEntity> it = inFlight.iterator();
            while (it.hasNext()) {
                TntEntity tnt = it.next();
                if (expired || tnt.isOnGround()) {
                    // One tick, not zero: a fuse of zero is already spent, and
                    // the entity has to tick once more to notice.
                    tnt.setFuse(1);
                    it.remove();
                }
            }
            return !expired && (spawning[0] || !inFlight.isEmpty());
        });

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
