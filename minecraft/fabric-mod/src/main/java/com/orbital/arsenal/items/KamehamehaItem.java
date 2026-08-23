package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
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
 * Charge through KA-ME-HA-ME-HAAA, then a beam that bores straight through
 * whatever it meets.
 *
 * The beam is drawn with particles rather than entities. The Bedrock version
 * had to string hundreds of cube entities along the line to get a visible
 * shaft; here end_rod gives the white-hot core and soul_fire_flame the blue
 * sheath, at no entity cost at all.
 */
public class KamehamehaItem extends Item {
    private static final int RANGE = 160;
    private static final double STRIDE = 2.0;
    private static final int BORE = 5;
    private static final double CORE_STEP = 0.5;
    private static final double SHEATH_RADIUS = 1.8;
    private static final int COOLDOWN = 160;
    private static final String[] SYLLABLES = {"KA", "ME", "HA", "ME", "HAAA!"};

    public KamehamehaItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Journal.arm();
        charge(serverWorld, user, 0);
        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private void charge(ServerWorld world, PlayerEntity user, int step) {
        if (step >= SYLLABLES.length) {
            // Aim is read here rather than when the charge started, so the
            // target can be tracked while winding up.
            fire(world, user, user.getEyePos(), user.getRotationVec(1.0F), 0.0);
            return;
        }
        user.sendMessage(Text.literal("\u00a7b\u00a7l" + SYLLABLES[step]), true);
        world.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 1.0F, 0.6F + step * 0.3F);

        // A ball of ki swelling at the hands, one ring per syllable.
        Vec3d hands = user.getEyePos().add(user.getRotationVec(1.0F).multiply(1.3));
        double size = 0.35 + step * 0.22;
        Strikes.puff(world, ParticleTypes.END_ROD, hands, 12, size, 0.01);
        Strikes.puff(world, ParticleTypes.SOUL_FIRE_FLAME, hands, 18, size * 1.6, 0.01);

        Scheduler.after(10, () -> charge(world, user, step + 1));
    }

    private void fire(ServerWorld world, PlayerEntity user, Vec3d origin, Vec3d direction, double reached) {
        if (reached == 0.0) {
            user.sendMessage(Text.literal("\u00a7b\u00a7lHAAAAA!"), true);
            world.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                    SoundCategory.MASTER, 3.0F, 1.4F);
        }
        if (reached >= RANGE) {
            Vec3d end = origin.add(direction.multiply(RANGE));
            Strikes.blast(world, end, 6.0F);
            return;
        }

        // Advance a slice per tick: bore it out, then light it up.
        double to = Math.min(RANGE, reached + 8.0);
        for (double d = reached; d < to; d += STRIDE) {
            Vec3d at = origin.add(direction.multiply(d));
            bore(world, at);
        }
        for (double d = reached; d < to; d += CORE_STEP) {
            Vec3d at = origin.add(direction.multiply(d));
            Strikes.puff(world, ParticleTypes.END_ROD, at, 2, 0.25, 0.0);
            Strikes.puff(world, ParticleTypes.SOUL_FIRE_FLAME, at, 3, SHEATH_RADIUS, 0.0);
        }

        Scheduler.after(1, () -> fire(world, user, origin, direction, to));
    }

    /** Clear a sphere around one point on the beam line. */
    private void bore(ServerWorld world, Vec3d at) {
        int cx = (int) Math.floor(at.x);
        int cy = (int) Math.floor(at.y);
        int cz = (int) Math.floor(at.z);
        BlockPos.Mutable pos = new BlockPos.Mutable();
        int squared = BORE * BORE;
        for (int x = -BORE; x <= BORE; x++) {
            for (int y = -BORE; y <= BORE; y++) {
                for (int z = -BORE; z <= BORE; z++) {
                    if (x * x + y * y + z * z > squared) {
                        continue;
                    }
                    pos.set(cx + x, cy + y, cz + z);
                    BlockState state = world.getBlockState(pos);
                    if (!state.isAir()) {
                        Journal.clear(world, pos, state, Blocks.AIR.getDefaultState());
                    }
                }
            }
        }
    }
}
