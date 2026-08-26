package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.FallingBlockEntity;
import net.minecraft.entity.SpawnReason;
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
 * Fires a cat.
 *
 * Not a cat-shaped projectile — an actual cat, five hundred blocks of orange
 * and white wool assembled in the air in front of the muzzle and thrown
 * downrange as a single body. It holds its shape in flight for the same reason
 * the giant potato does: every falling block in Minecraft accelerates
 * identically, so a cluster released on the same tick with the same velocity
 * stays a cluster. There is no rigid-body physics here to borrow, and none is
 * needed.
 *
 * Where it lands it digs a crater forty-four blocks across, and then a thousand
 * live cats come out of the hole in a sphere.
 */
public class CatBazookaItem extends Item {
    /** How hard the cat leaves the tube, in blocks per tick. */
    private static final double MUZZLE_SPEED = 2.6;
    /** If it somehow never touches down, go off anyway rather than hanging. */
    private static final int MAX_FLIGHT = 400;

    private static final int CRATER_RADIUS = 22;
    private static final int CRATER_DEPTH = 12;
    private static final int CARVE_PER_TICK = 12_000;

    private static final int CATS = 1000;
    /** A thousand mobs on one tick is a visible freeze. Twenty ticks is not. */
    private static final int CATS_PER_TICK = 50;
    private static final double BURST_RADIUS = 3.0;
    private static final double BURST_SPEED = 1.1;
    /** Cats vanish after three minutes, or the world never stops being cats. */
    private static final int CAT_LIFETIME = 3_600;

    private static final int COOLDOWN = 200;

    public CatBazookaItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Vec3d aim = user.getRotationVec(1.0F).normalize();
        // Four blocks clear of the shooter, or the cat assembles inside them.
        Vec3d muzzle = new Vec3d(user.getX(), user.getY() + 1.6, user.getZ())
                .add(aim.multiply(4.0));

        List<Entity> cat = launch(serverWorld, muzzle, aim);

        user.sendMessage(Text.literal("§6🐈 CAT AWAY — " + cat.size() + " blocks of cat"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_GENERIC_EXPLODE,
                SoundCategory.MASTER, 4.0F, 0.8F);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_CAT_HISS.value(),
                SoundCategory.MASTER, 4.0F, 0.6F);

        watch(serverWorld, user, cat);

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /**
     * Assemble the cat at the muzzle and throw it.
     *
     * A block has to exist somewhere before it can be made to fall, so each one
     * is placed and released on the same tick. The placement lasts a single
     * tick, in mid-air, where there is nothing to disturb.
     */
    private List<Entity> launch(ServerWorld world, Vec3d muzzle, Vec3d aim) {
        List<Entity> parts = new ArrayList<>();
        int cx = (int) Math.floor(muzzle.x);
        int cy = (int) Math.floor(muzzle.y);
        int cz = (int) Math.floor(muzzle.z);
        Vec3d shove = aim.multiply(MUZZLE_SPEED);
        BlockPos.Mutable pos = new BlockPos.Mutable();

        for (int x = -12; x <= 12; x++) {
            for (int y = -8; y <= 9; y++) {
                for (int z = -6; z <= 6; z++) {
                    Block block = paint(x, y, z);
                    if (block == null) {
                        continue;
                    }
                    BlockState state = block.getDefaultState();
                    pos.set(cx + x, cy + y, cz + z);
                    BlockPos at = pos.toImmutable();
                    world.setBlockState(at, state, 2);
                    FallingBlockEntity part = FallingBlockEntity.spawnFromBlock(world, at, state);
                    if (part != null) {
                        part.dropItem = false;
                        part.setVelocity(shove);
                        parts.add(part);
                    }
                }
            }
        }
        return parts;
    }

    /**
     * The cat, as a function of position.
     *
     * Tested in isolation before it was ever built in-game: the checks run in
     * this order so that detail wins over bulk — the eyes are inside the head
     * sphere and the black ear tips are inside the ears, so each has to be
     * asked about first or the plain colour underneath would swallow it.
     * Returns null for empty space.
     */
    private static Block paint(int x, int y, int z) {
        // Tail: a curve arcing up and back off the rear, sampled as a string
        // of small spheres because a swept curve is far easier to get right
        // than a closed-form solid.
        for (int i = 0; i <= 10; i++) {
            double f = i / 10.0;
            double tx = -5.5 - 3.2 * Math.sin(f * 1.5);
            double ty = 0.5 + 5.0 * f * f;
            if (sq(x - tx) + sq(y - ty) + sq(z) <= sq(1.15)) {
                return Blocks.ORANGE_WOOL;
            }
        }

        // Four legs, hanging below the barrel of the body.
        for (int lx = -1; lx <= 1; lx += 2) {
            for (int lz = -1; lz <= 1; lz += 2) {
                if (Math.abs(x - lx * 3.2) <= 1.2 && Math.abs(z - lz * 2.0) <= 1.2
                        && y >= -6.5 && y <= -2.5) {
                    return Blocks.ORANGE_WOOL;
                }
            }
        }

        // Head, with the face on it.
        if (sq(x - 6.4) + sq(y - 2.6) + sq(z) <= sq(3.1)) {
            for (int ez = -1; ez <= 1; ez += 2) {
                if (sq(x - 8.6) + sq(y - 3.4) + sq(z - ez * 1.3) <= sq(0.9)) {
                    return Blocks.BLACK_WOOL;
                }
            }
            if (sq(x - 9.2) + sq(y - 2.0) + sq(z) <= sq(1.0)) {
                return Blocks.PINK_WOOL;
            }
            return y < 1.4 ? Blocks.WHITE_WOOL : Blocks.ORANGE_WOOL;
        }

        // Ears, tipped in black.
        for (int ez = -1; ez <= 1; ez += 2) {
            if (sq(x - 5.9) + sq(y - 5.4) + sq(z - ez * 1.9) <= sq(1.35)) {
                return y > 5.6 ? Blocks.BLACK_WOOL : Blocks.ORANGE_WOOL;
            }
        }

        // Body: an ellipsoid, longer than it is tall, white on the underside.
        if (sq(x / 5.6) + sq(y / 3.3) + sq(z / 3.3) <= 1.0) {
            return y < -1.6 ? Blocks.WHITE_WOOL : Blocks.ORANGE_WOOL;
        }
        return null;
    }

    private static double sq(double v) {
        return v * v;
    }

    /** Follow the cat down and fire when any part of it touches something. */
    private void watch(ServerWorld world, PlayerEntity user, List<Entity> cat) {
        int[] age = {0};
        Scheduler.repeat(() -> {
            age[0]++;
            Entity lead = null;
            boolean landed = false;
            for (Entity part : cat) {
                if (lead == null && !part.isRemoved()) {
                    lead = part;
                }
                if (part.isOnGround() || part.isRemoved()) {
                    landed = true;
                    break;
                }
            }
            if (!landed && age[0] < MAX_FLIGHT) {
                if (lead != null && age[0] % 2 == 0) {
                    world.spawnParticles(ParticleTypes.CLOUD, true, true,
                            lead.getX(), lead.getY(), lead.getZ(), 8, 2.0, 1.5, 2.0, 0.02);
                }
                return true;
            }

            // Where it actually ended up, not where it was aimed. Take the
            // position before discarding, or there is nothing left to ask.
            Vec3d at = lead != null
                    ? new Vec3d(lead.getX(), lead.getY(), lead.getZ())
                    : new Vec3d(cat.get(0).getX(), cat.get(0).getY(), cat.get(0).getZ());

            // Clear the rest of the cat first, or blocks still in the air
            // would rain into the finished crater.
            for (Entity part : cat) {
                part.discard();
            }
            impact(world, user, at);
            return false;
        });
    }

    private void impact(ServerWorld world, PlayerEntity user, Vec3d at) {
        world.playSound(null, BlockPos.ofFloored(at), SoundEvents.ENTITY_GENERIC_EXPLODE,
                SoundCategory.MASTER, 100.0F, 0.5F);
        world.playSound(null, BlockPos.ofFloored(at), SoundEvents.ENTITY_CAT_PURREOW.value(),
                SoundCategory.MASTER, 100.0F, 0.7F);
        world.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                at.x, at.y + 3, at.z, 240, 9.0, 4.0, 9.0, 0.1);

        int cx = (int) Math.floor(at.x);
        int cy = (int) Math.floor(at.y);
        int cz = (int) Math.floor(at.z);
        int[] dy = {4};
        int[] x = {Integer.MIN_VALUE};
        BlockPos.Mutable pos = new BlockPos.Mutable();
        BlockState air = Blocks.AIR.getDefaultState();

        Scheduler.repeat(() -> {
            int budget = CARVE_PER_TICK;
            while (budget > 0) {
                if (dy[0] < -CRATER_DEPTH) {
                    pour(world, user, at);
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

    /** Bowl profile: full depth in the middle, rising to ground level at the rim. */
    private static double radiusAt(int dy) {
        if (dy >= 0) {
            return dy <= 4 ? CRATER_RADIUS : 0.0;
        }
        int below = -dy;
        return below > CRATER_DEPTH ? 0.0
                : CRATER_RADIUS * Math.sqrt(1.0 - below / (double) CRATER_DEPTH);
    }

    /**
     * A thousand cats, outward, in a ball.
     *
     * The directions come from a golden-angle spiral rather than random draws.
     * Random points on a sphere clump — a thousand of them would leave visible
     * bald patches and dense knots. The spiral is even by construction, so the
     * burst is a shell rather than a cloud.
     */
    private void pour(ServerWorld world, PlayerEntity user, Vec3d at) {
        Vec3d centre = at.add(0, 2.0, 0);
        int[] sent = {0};
        double golden = Math.PI * (1.0 + Math.sqrt(5.0));

        Scheduler.repeat(() -> {
            List<Entity> wave = new ArrayList<>();
            for (int n = 0; n < CATS_PER_TICK && sent[0] < CATS; n++, sent[0]++) {
                int i = sent[0];
                // Evenly spaced in cos(phi), which is what makes the spacing
                // even on the sphere itself rather than bunched at the poles.
                double phi = Math.acos(1.0 - 2.0 * (i + 0.5) / CATS);
                double theta = golden * i;
                double dx = Math.sin(phi) * Math.cos(theta);
                double dy = Math.cos(phi);
                double dz = Math.sin(phi) * Math.sin(theta);

                Entity cat = EntityType.CAT.create(world, SpawnReason.EVENT);
                if (cat == null) {
                    continue;
                }
                cat.setPosition(centre.x + dx * BURST_RADIUS,
                        centre.y + dy * BURST_RADIUS,
                        centre.z + dz * BURST_RADIUS);
                world.spawnEntity(cat);
                // Bias the kick upward: cats thrown level just skid along the
                // crater floor, and the shape is only visible in the air.
                cat.addVelocity(dx * BURST_SPEED,
                        Math.abs(dy) * BURST_SPEED * 0.7 + 0.3,
                        dz * BURST_SPEED);
                wave.add(cat);
            }

            // Each wave clears itself, so nothing has to track the whole
            // thousand for three minutes.
            Scheduler.after(CAT_LIFETIME, () -> {
                for (Entity cat : wave) {
                    if (!cat.isRemoved()) {
                        world.spawnParticles(ParticleTypes.POOF, true, true,
                                cat.getX(), cat.getY() + 0.3, cat.getZ(), 4, 0.2, 0.2, 0.2, 0.01);
                        cat.discard();
                    }
                }
            });

            if (sent[0] >= CATS) {
                user.sendMessage(Text.literal("§e🐈 " + CATS + " cats deployed"), true);
                return false;
            }
            return true;
        });
    }
}
