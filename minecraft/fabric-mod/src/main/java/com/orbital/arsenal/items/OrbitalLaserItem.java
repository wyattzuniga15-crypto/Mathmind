package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
import java.util.IdentityHashMap;
import java.util.Map;
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
 * A beam from orbit that keeps firing and follows wherever you look.
 *
 * Every other weapon here deletes a fixed shape decided at the moment it is
 * fired. This one is steered: each tick it re-reads the player's aim and cuts
 * a column at whatever it finds, so walking or turning drags a canyon behind
 * you rather than stamping out one crater.
 *
 * It is a toggle rather than a hold, which is deliberate. Holding right-click
 * re-fires use() every few ticks in vanilla, and a hold-to-fire item built on
 * that flickers on and off; toggling sidesteps the whole problem.
 */
public class OrbitalLaserItem extends Item {
    private static final double RANGE = 200.0;
    private static final int BORE = 7;        // radius — 15 blocks across
    private static final int ABOVE = 20;      // cut trees and rooftops above the aim
    private static final int FLOOR = -60;     // just above overworld bedrock
    private static final int MAX_TICKS = 400; // 20 seconds, then it shuts itself off
    private static final int MIN_TICKS = 10;  // ignore the repeat-clicks of one hold
    private static final int CLICK_GAP = 8;   // a real second click, not a held one
    private static final int COOLDOWN = 100;
    private static final int BLAST_EVERY = 10;

    /**
     * Who is firing. Keyed on the player object rather than a UUID because
     * identity is all this needs, and it is cleared on shutdown either way.
     */
    private static final Map<PlayerEntity, Beam> FIRING = new IdentityHashMap<>();

    private static final class Beam {
        int age;
        int lastUse;
        boolean stopping;
    }

    public OrbitalLaserItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Journal.arm();
        Beam running = FIRING.get(user);
        if (running != null) {
            // Holding right-click re-fires use() about every four ticks, so a
            // second call is not necessarily a second click. Spacing tells them
            // apart: a held button arrives on a steady short beat, a deliberate
            // click comes after a gap. Without this, holding the button would
            // shut the beam off half a second after it lit up.
            int gap = running.age - running.lastUse;
            running.lastUse = running.age;
            if (running.age >= MIN_TICKS && gap > CLICK_GAP) {
                running.stopping = true;
            }
            return ActionResult.SUCCESS;
        }

        Beam beam = new Beam();
        FIRING.put(user, beam);
        user.sendMessage(Text.literal("§b▼ ORBITAL LASER ONLINE — right-click again to cease fire"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 6.0F, 1.8F);

        Scheduler.repeat(() -> {
            beam.age++;
            if (beam.stopping || beam.age > MAX_TICKS) {
                shutdown(serverWorld, user, hand);
                return false;
            }
            Vec3d at = Strikes.aim(user, RANGE);
            cut(serverWorld, at);
            draw(serverWorld, at);
            if (beam.age % BLAST_EVERY == 0) {
                // Not for the blocks — the column has already taken those. This
                // is what makes the beam hurt anything standing in it.
                Strikes.blast(serverWorld, at, 4.0F);
            }
            return true;
        });

        return ActionResult.SUCCESS;
    }

    /** Clear a vertical column at the aim point, from above it down to bedrock. */
    private void cut(ServerWorld world, Vec3d at) {
        int cx = (int) Math.floor(at.x);
        int cz = (int) Math.floor(at.z);
        int top = (int) Math.floor(at.y) + ABOVE;
        BlockPos.Mutable pos = new BlockPos.Mutable();
        BlockState air = Blocks.AIR.getDefaultState();

        for (int x = -BORE; x <= BORE; x++) {
            int half = (int) Math.sqrt(Math.max(0.0, (double) BORE * BORE - (double) x * x));
            for (int z = -half; z <= half; z++) {
                for (int y = top; y >= FLOOR; y--) {
                    pos.set(cx + x, y, cz + z);
                    BlockState state = world.getBlockState(pos);
                    // Bedrock stays, as with the nuke and the black hole: a hole
                    // through the world floor cannot be repaired.
                    if (!state.isAir() && !state.isOf(Blocks.BEDROCK)) {
                        Journal.clear(world, pos, state, air);
                    }
                }
            }
        }
    }

    /**
     * The beam itself. Only the column the player can see is drawn — 90 blocks
     * up from the impact — since the shaft continuing down a hole it has
     * already cleared is not visible from anywhere.
     */
    private void draw(ServerWorld world, Vec3d at) {
        for (int y = 0; y < 90; y += 3) {
            Vec3d point = at.add(0.0, y, 0.0);
            Strikes.puff(world, ParticleTypes.END_ROD, point, 4, 1.2, 0.0);
            Strikes.puff(world, ParticleTypes.SOUL_FIRE_FLAME, point, 3, 3.0, 0.0);
        }
        Strikes.puff(world, ParticleTypes.EXPLOSION, at, 3, 2.0, 0.0);
    }

    private void shutdown(ServerWorld world, PlayerEntity user, Hand hand) {
        FIRING.remove(user);
        user.sendMessage(Text.literal("§7▼ laser offline"), true);
        world.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 1.0F, 0.5F);
        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
    }
}
