package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.FallingBlockEntity;
import net.minecraft.entity.player.PlayerEntity;
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
 * Drops an enormous potato on the world from ninety blocks up.
 *
 * The potato is real: about a thousand blocks arranged in a lumpy ellipsoid,
 * each spawned as a falling block. They hold their shape all the way down for
 * a reason worth knowing — every falling block in Minecraft accelerates
 * identically, so a cluster released together stays a cluster. No rigid-body
 * machinery is needed, and none exists to be borrowed; the physics does it.
 *
 * When it lands it leaves a crater eighty blocks across, and the crater floor
 * is then tilled and planted. The thing that flattened the hillside still
 * feeds you.
 */
public class PotatoBombItem extends ArsenalItem {
    /** Radii of the potato, in blocks. Longer than it is thick, like a potato. */
    private static final int RX = 8;
    private static final int RY = 5;
    private static final int RZ = 6;
    private static final int DROP_HEIGHT = 90;

    private static final int CRATER_RADIUS = 40;
    private static final int CRATER_DEPTH = 22;
    private static final int CARVE_PER_TICK = 14_000;

    /** If it somehow never lands, go off anyway rather than hanging forever. */
    private static final int MAX_FALL = 600;
    private static final int PLANT_PER_TICK = 3_000;
    private static final int COOLDOWN = 200;

    public PotatoBombItem(Settings settings) {
        super(settings, "Drops an enormous potato on the world from ninety blocks up.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Vec3d target = Strikes.aim(user, 150.0);
        List<Entity> potato = build(serverWorld, target);

        user.sendMessage(Text.literal("§6🥔 INCOMING — " + potato.size() + " blocks of potato"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 4.0F, 0.7F);

        watch(serverWorld, user, target, potato);

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /**
     * Assemble the potato in the sky.
     *
     * A block has to exist somewhere before it can be made to fall, so each one
     * is placed and then immediately released — the placement lasts a single
     * tick and happens ninety blocks up, where there is nothing to disturb.
     */
    private List<Entity> build(ServerWorld world, Vec3d target) {
        List<Entity> parts = new ArrayList<>();
        int cx = (int) Math.floor(target.x);
        int cy = (int) Math.floor(target.y) + DROP_HEIGHT;
        int cz = (int) Math.floor(target.z);
        BlockPos.Mutable pos = new BlockPos.Mutable();

        // Assembled in mid-air and released on the same tick, so none of it
        // is part of the world for longer than that. Filing it would spend
        // thousands of entries per drop on a shape nobody can undo.
        Journal.unrecorded(() -> {
            for (int x = -RX; x <= RX; x++) {
                for (int y = -RY; y <= RY; y++) {
                    for (int z = -RZ; z <= RZ; z++) {
                        double shape = (double) (x * x) / (RX * RX)
                                + (double) (y * y) / (RY * RY)
                                + (double) (z * z) / (RZ * RZ);
                        // A plain ellipsoid reads as an egg. The wobble is what
                        // makes it lumpy enough to be a potato.
                        double lump = Math.sin(x * 0.8) * 0.05
                                + Math.cos(z * 1.1) * 0.05
                                + Math.sin(y * 1.4 + x * 0.3) * 0.04;
                        if (shape > 1.0 + lump) {
                            continue;
                        }
                        // Darker patches for the eyes of the potato.
                        boolean eye = (x * 7 + y * 13 + z * 5) % 17 == 0;
                        BlockState state = (eye ? Blocks.COARSE_DIRT : Blocks.PACKED_MUD)
                                .getDefaultState();

                        pos.set(cx + x, cy + y, cz + z);
                        BlockPos at = pos.toImmutable();
                        world.setBlockState(at, state, 2);
                        FallingBlockEntity block = FallingBlockEntity.spawnFromBlock(world, at, state);
                        if (block != null) {
                            block.dropItem = false;
                            parts.add(block);
                        }
                    }
                }
            }
        });

        return parts;
    }

    /** Wait for it to hit, then make the hole. */
    private void watch(ServerWorld world, PlayerEntity user, Vec3d target, List<Entity> potato) {
        int[] age = {0};
        Scheduler.repeat(() -> {
            age[0]++;
            boolean landed = false;
            for (Entity part : potato) {
                if (part.isOnGround() || part.isRemoved()) {
                    landed = true;
                    break;
                }
            }
            if (!landed && age[0] < MAX_FALL) {
                if (age[0] % 4 == 0) {
                    // A dust trail, so it is obvious something is coming down.
                    Entity lead = potato.isEmpty() ? null : potato.get(0);
                    if (lead != null) {
                        world.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                                lead.getX(), lead.getY(), lead.getZ(), 12, 4.0, 2.0, 4.0, 0.02);
                    }
                }
                return true;
            }

            // Clear whatever is left of the potato before carving, or the
            // blocks still in the air would rain into the finished crater.
            for (Entity part : potato) {
                part.discard();
            }
            impact(world, user, target);
            return false;
        });
    }

    private void impact(ServerWorld world, PlayerEntity user, Vec3d target) {
        Strikes.blast(world, target.add(0, 2, 0), 10.0F);
        world.playSound(null, BlockPos.ofFloored(target), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 100.0F, 0.5F);
        world.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                target.x, target.y + 3, target.z, 300, 14.0, 5.0, 14.0, 0.1);

        int cx = (int) Math.floor(target.x);
        int cy = (int) Math.floor(target.y);
        int cz = (int) Math.floor(target.z);
        int[] dy = {6};
        int[] x = {Integer.MIN_VALUE};
        BlockPos.Mutable pos = new BlockPos.Mutable();
        BlockState air = Blocks.AIR.getDefaultState();

        Scheduler.repeat(() -> {
            int budget = CARVE_PER_TICK;
            while (budget > 0) {
                if (dy[0] < -CRATER_DEPTH) {
                    plant(world, user, target);
                    return false;
                }
                double r = radiusAt(dy[0]);
                if (r <= 0.0) {
                    dy[0]--;
                    x[0] = Integer.MIN_VALUE;
                    continue;
                }
                int span = (int) r;
                if (x[0] == Integer.MIN_VALUE) {
                    x[0] = -span;
                }
                int half = (int) Math.sqrt(Math.max(0.0, r * r - (double) x[0] * x[0]));
                for (int z = -half; z <= half; z++) {
                    pos.set(cx + x[0], cy + dy[0], cz + z);
                    BlockState state = world.getBlockState(pos);
                    if (!state.isAir() && !state.isOf(Blocks.BEDROCK)) {
                        // Through the Journal, so the clocks can put it back.
                        Journal.clear(world, pos.toImmutable(), state, air);
                    }
                }
                budget -= (2 * half + 1);
                if (++x[0] > span) {
                    dy[0]--;
                    x[0] = Integer.MIN_VALUE;
                }
            }
            return true;
        });
    }

    /** Bowl profile: full depth at the middle, rising to ground level at the rim. */
    private static double radiusAt(int dy) {
        if (dy >= 0) {
            return dy <= 6 ? CRATER_RADIUS : 0.0;
        }
        int below = -dy;
        return below > CRATER_DEPTH ? 0.0
                : CRATER_RADIUS * Math.sqrt(1.0 - below / (double) CRATER_DEPTH);
    }

    /** Till and sow whatever floor the impact left. */
    private void plant(ServerWorld world, PlayerEntity user, Vec3d target) {
        int cx = (int) Math.floor(target.x);
        int cy = (int) Math.floor(target.y);
        int cz = (int) Math.floor(target.z);
        int span = CRATER_RADIUS;
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
                    // Walk down to the first solid block: after an impact the
                    // floor is nowhere near the height it was aimed at.
                    for (int y = cy + 10; y > cy - CRATER_DEPTH - 8; y--) {
                        pos.set(cx + x[0], y, cz + z);
                        BlockState state = world.getBlockState(pos);
                        if (state.isAir() || state.isOf(Blocks.BEDROCK)) {
                            continue;
                        }
                        BlockPos ground = pos.toImmutable();
                        BlockPos above = ground.up();
                        if (world.getBlockState(above).isAir()) {
                            // Crops need farmland under them or they pop off.
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
    }
}
