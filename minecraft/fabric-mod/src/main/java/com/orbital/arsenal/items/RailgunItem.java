package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * Bores a perfectly straight shaft along your line of sight.
 *
 * Not a crater — a tunnel. Through the mountain, out the far side, and on
 * until it runs out of range. The bore is walked one metre at a time along the
 * aim vector rather than by stepping a driving axis, so a shot at any angle is
 * the same clean cylinder; stepping an axis leaves a staircase on diagonals.
 */
public class RailgunItem extends ArsenalItem {
    private static final int RANGE = 400;
    private static final double BORE = 2.6;
    /** One metre of shaft per step; a step longer than the bore leaves gaps. */
    private static final double STEP = 1.0;
    private static final int PER_TICK = 24;
    private static final int COOLDOWN = 100;

    public RailgunItem(Settings settings) {
        super(settings, "Bores a perfectly straight shaft along your line of sight.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Vec3d aim = user.getRotationVec(1.0F).normalize();
        Vec3d muzzle = new Vec3d(user.getX(), user.getY() + 1.5, user.getZ());

        user.sendMessage(Text.literal("§b⚡ RAILGUN"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 4.0F, 1.4F);

        int[] step = {2};
        int[] carved = {0};
        BlockPos.Mutable pos = new BlockPos.Mutable();
        BlockState air = Blocks.AIR.getDefaultState();
        int span = (int) Math.ceil(BORE);

        Scheduler.repeat(() -> {
            for (int n = 0; n < PER_TICK && step[0] < RANGE; n++, step[0]++) {
                Vec3d centre = muzzle.add(aim.multiply(step[0] * STEP));
                int cx = (int) Math.floor(centre.x);
                int cy = (int) Math.floor(centre.y);
                int cz = (int) Math.floor(centre.z);

                for (int x = -span; x <= span; x++) {
                    for (int y = -span; y <= span; y++) {
                        for (int z = -span; z <= span; z++) {
                            // Distance from the axis, not from this sample —
                            // otherwise the shaft beads instead of running straight.
                            double dx = cx + x + 0.5 - muzzle.x;
                            double dy = cy + y + 0.5 - muzzle.y;
                            double dz = cz + z + 0.5 - muzzle.z;
                            double along = dx * aim.x + dy * aim.y + dz * aim.z;
                            double ox = dx - aim.x * along;
                            double oy = dy - aim.y * along;
                            double oz = dz - aim.z * along;
                            if (ox * ox + oy * oy + oz * oz > BORE * BORE) {
                                continue;
                            }
                            pos.set(cx + x, cy + y, cz + z);
                            BlockState state = serverWorld.getBlockState(pos);
                            if (!state.isAir() && !state.isOf(Blocks.BEDROCK)) {
                                Journal.clear(serverWorld, pos.toImmutable(), state, air);
                                carved[0]++;
                            }
                        }
                    }
                }

                // Anything standing in the beam goes with it.
                Box hit = new Box(centre.x - BORE, centre.y - BORE, centre.z - BORE,
                        centre.x + BORE, centre.y + BORE, centre.z + BORE);
                for (Entity entity : serverWorld.getOtherEntities(user, hit)) {
                    if (entity instanceof LivingEntity living) {
                        living.kill(serverWorld);
                    }
                }

                if (step[0] % 6 == 0) {
                    serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                            centre.x, centre.y, centre.z, 6, 0.4, 0.4, 0.4, 0.02);
                }
            }
            if (step[0] < RANGE) {
                return true;
            }
            user.sendMessage(Text.literal("§b⚡ " + carved[0] + " blocks bored"), true);
            return false;
        });

        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
