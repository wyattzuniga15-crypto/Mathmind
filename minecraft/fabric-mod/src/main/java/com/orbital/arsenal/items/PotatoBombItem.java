package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Formation;
import com.orbital.arsenal.weapons.Shells;
import com.orbital.arsenal.weapons.Strikes;
import java.util.List;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
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

/**
 * A cluster bomb that leaves a potato farm where the crater was.
 *
 * The only weapon here that gives something back. It splits into 300 charges
 * over a 70-block circle, and once the dust settles the whole crater floor is
 * tilled and planted — so the thing that just flattened the hillside also feeds
 * you.
 *
 * The planting waits on the blast rather than running with it. Shells detonate
 * when they land, and the last of them can be in the air for several seconds
 * after the first goes off; planting before then would sow a field and then
 * blow it up.
 */
public class PotatoBombItem extends Item {
    private static final int CHARGES = 300;
    private static final double RADIUS = 35.0;
    private static final int RINGS = 9;
    private static final int DROP_HEIGHT = 45;
    private static final int PER_TICK = 60;
    private static final int COOLDOWN = 160;

    /** Long enough for every shell to have landed and gone off. */
    private static final int PLANT_DELAY = 160;
    private static final int PLANT_PER_TICK = 2000;
    /** How far above the aim point to start looking for the crater floor. */
    private static final int SCAN_ABOVE = 25;
    private static final int SCAN_BELOW = 45;

    public PotatoBombItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Vec3d target = Strikes.aim(user, 150.0);
        List<Formation.Offset> formation = Formation.rings(CHARGES, RADIUS, RINGS);

        user.sendMessage(Text.literal("§6🥔 POTATO BOMB — " + CHARGES + " charges"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 3.0F, 1.6F);

        int[] spawned = {0};
        Scheduler.repeat(() -> {
            for (int i = 0; i < PER_TICK && spawned[0] < formation.size(); i++, spawned[0]++) {
                Formation.Offset offset = formation.get(spawned[0]);
                Shells.drop(serverWorld,
                        target.x + offset.x(), target.y + DROP_HEIGHT, target.z + offset.z());
            }
            return spawned[0] < formation.size();
        });

        Scheduler.after(PLANT_DELAY, () -> plant(serverWorld, target, user));

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /** Till and sow whatever surface the blast left behind. */
    private void plant(ServerWorld world, Vec3d target, PlayerEntity user) {
        int cx = (int) Math.floor(target.x);
        int cy = (int) Math.floor(target.y);
        int cz = (int) Math.floor(target.z);
        int span = (int) RADIUS;

        int[] x = {-span};
        int[] planted = {0};
        BlockPos.Mutable pos = new BlockPos.Mutable();

        Scheduler.repeat(() -> {
            int budget = PLANT_PER_TICK;
            while (budget > 0) {
                if (x[0] > span) {
                    user.sendMessage(Text.literal(
                            "§a🥔 " + planted[0] + " potatoes planted in the crater"), true);
                    return false;
                }
                int half = (int) Math.sqrt(Math.max(0.0,
                        (double) span * span - (double) x[0] * x[0]));
                for (int z = -half; z <= half; z++) {
                    // Walk down to the first solid block: after a blast the
                    // floor is nowhere near the height it was aimed at, and
                    // planting at a fixed level would sow into thin air.
                    for (int y = cy + SCAN_ABOVE; y > cy - SCAN_BELOW; y--) {
                        pos.set(cx + x[0], y, cz + z);
                        BlockState state = world.getBlockState(pos);
                        if (state.isAir() || state.isOf(Blocks.BEDROCK)) {
                            continue;
                        }
                        // Crops need farmland under them or they pop straight
                        // off, so the ground is tilled before it is sown.
                        BlockPos ground = pos.toImmutable();
                        BlockPos above = ground.up();
                        if (world.getBlockState(above).isAir()) {
                            Journal.clear(world, ground, state, Blocks.FARMLAND.getDefaultState());
                            Journal.clear(world, above, world.getBlockState(above),
                                    Blocks.POTATOES.getDefaultState());
                            planted[0]++;
                        }
                        break;
                    }
                }
                budget -= (2 * half + 1);
                x[0]++;
            }
            return true;
        });

        Strikes.puff(world, ParticleTypes.LARGE_SMOKE, target.add(0, 2, 0), 60, 8.0, 0.05);
    }
}
