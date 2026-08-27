package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import java.util.HashMap;
import java.util.Map;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.FallingBlockEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * Rips something loose, holds it in front of you, and throws it.
 *
 * The held thing is carried by setting its position every tick rather than by
 * any joint or constraint — there is nothing in Minecraft to attach one entity
 * to another, and a per-tick reposition is indistinguishable from one at the
 * speed the game draws. Letting go simply stops doing that and hands the thing
 * a velocity.
 */
public class GravityGunItem extends ArsenalItem {
    /** What each player is holding. One thing each, deliberately. */
    // Keyed by UUID rather than by the player object. A PlayerEntity is
    // replaced on every respawn and every dimension change, so an
    // identity-keyed map silently loses the entry the moment you die — and
    // because nothing removes entries on disconnect, it also holds the old
    // entity, and through it the whole world, for as long as the server runs.
    // A UUID is stable across both and holds nothing.
    private static final Map<java.util.UUID, Entity> HELD = new HashMap<>();

    private static final double GRAB_RANGE = 40.0;
    private static final double CARRY = 4.0;
    private static final double THROW_SPEED = 2.4;

    public GravityGunItem(Settings settings) {
        super(settings, "Rips something loose, holds it in front of you, and throws it.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Entity holding = HELD.get(user.getUuid());
        if (holding != null && !holding.isRemoved()) {
            fling(serverWorld, user, holding);
            return ActionResult.SUCCESS;
        }

        // A mob in front of you wins over the block behind it — you are far
        // more likely to have meant the creeper than the wall past it.
        Entity mob = lookingAt(serverWorld, user);
        if (mob != null) {
            hold(serverWorld, user, mob, "§a✋ Got it.");
            return ActionResult.SUCCESS;
        }

        HitResult hit = user.raycast(GRAB_RANGE, 1.0F, false);
        BlockPos at = BlockPos.ofFloored(hit.getPos().subtract(
                user.getRotationVec(1.0F).normalize().multiply(0.4)));
        BlockState state = serverWorld.getBlockState(at);
        if (state.isAir() || state.isOf(Blocks.BEDROCK)) {
            user.sendMessage(Text.literal("§7Nothing to grab."), true);
            return ActionResult.SUCCESS;
        }

        // Through the journal, so the clocks can put back whatever is torn out.
        Journal.clear(serverWorld, at, state, Blocks.AIR.getDefaultState());
        FallingBlockEntity block = FallingBlockEntity.spawnFromBlock(serverWorld, at, state);
        if (block == null) {
            return ActionResult.SUCCESS;
        }
        block.dropItem = false;
        hold(serverWorld, user, block, "§a✋ Got it.");
        return ActionResult.SUCCESS;
    }

    private Entity lookingAt(ServerWorld world, PlayerEntity user) {
        Vec3d eye = new Vec3d(user.getX(), user.getY() + 1.5, user.getZ());
        Vec3d aim = user.getRotationVec(1.0F).normalize();
        for (double d = 1.0; d < GRAB_RANGE; d += 1.0) {
            Vec3d probe = eye.add(aim.multiply(d));
            Box near = new Box(probe.x - 1.2, probe.y - 1.2, probe.z - 1.2,
                    probe.x + 1.2, probe.y + 1.2, probe.z + 1.2);
            for (Entity candidate : world.getOtherEntities(user, near)) {
                return candidate;
            }
        }
        return null;
    }

    private void hold(ServerWorld world, PlayerEntity user, Entity thing, String note) {
        HELD.put(user.getUuid(), thing);
        user.sendMessage(Text.literal(note + " §7Click again to throw."), true);
        world.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.PLAYERS, 1.0F, 0.6F);

        Scheduler.repeat(() -> {
            Entity still = HELD.get(user.getUuid());
            if (still != thing || thing.isRemoved() || user.isRemoved()) {
                return false;
            }
            Vec3d aim = user.getRotationVec(1.0F).normalize();
            Vec3d spot = new Vec3d(user.getX(), user.getY() + 1.4, user.getZ())
                    .add(aim.multiply(CARRY));
            thing.setPosition(spot.x, spot.y, spot.z);
            // Zeroed every tick: a falling block that keeps its downward
            // velocity slams into the ground the instant it is released.
            thing.setVelocity(Vec3d.ZERO);
            world.spawnParticles(ParticleTypes.END_ROD, true, true,
                    spot.x, spot.y, spot.z, 2, 0.3, 0.3, 0.3, 0.01);
            return true;
        });
    }

    private void fling(ServerWorld world, PlayerEntity user, Entity thing) {
        HELD.remove(user.getUuid());
        Vec3d aim = user.getRotationVec(1.0F).normalize().multiply(THROW_SPEED);
        thing.setVelocity(aim);
        user.sendMessage(Text.literal("§e✊ Thrown."), true);
        world.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.PLAYERS, 1.0F, 1.8F);
    }
}
