package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;

/**
 * A pulse that shows you every ore around you, through solid stone.
 *
 * The only item here that takes nothing away. Ores light up where they actually
 * are and hang there for ten seconds while you dig toward them.
 *
 * Colour comes from picking a different vanilla particle per ore rather than
 * tinting one — green villager motes for emerald, blue soul flame for lapis,
 * white end rod for diamond. Tinted dust would be the obvious way and needs a
 * particle that carries a colour parameter, and parameterised particles have
 * changed shape more than once between versions. These take no parameters at
 * all, so they cannot break that way.
 */
public class OreSenseItem extends Item {
    private static final int RADIUS = 32;
    private static final int SCAN_PER_TICK = 60_000;
    /** How long the ores stay lit, and how often they pulse. */
    private static final int SHOW_TICKS = 200;
    private static final int PULSE_EVERY = 10;
    private static final int COOLDOWN = 200;
    /** Enough for a rich cave, few enough that a lit-up ore field cannot choke the client. */
    private static final int MAX_FOUND = 3000;

    /** Which particle stands for which ore. Deepslate and normal share a colour. */
    private static ParticleEffect colourOf(BlockState state) {
        if (is(state, Blocks.DIAMOND_ORE, Blocks.DEEPSLATE_DIAMOND_ORE)) {
            return ParticleTypes.END_ROD;
        }
        if (is(state, Blocks.EMERALD_ORE, Blocks.DEEPSLATE_EMERALD_ORE)) {
            return ParticleTypes.HAPPY_VILLAGER;
        }
        if (is(state, Blocks.LAPIS_ORE, Blocks.DEEPSLATE_LAPIS_ORE)) {
            return ParticleTypes.SOUL_FIRE_FLAME;
        }
        if (is(state, Blocks.GOLD_ORE, Blocks.DEEPSLATE_GOLD_ORE, Blocks.NETHER_GOLD_ORE)) {
            return ParticleTypes.FLAME;
        }
        if (is(state, Blocks.IRON_ORE, Blocks.DEEPSLATE_IRON_ORE)) {
            return ParticleTypes.CLOUD;
        }
        if (is(state, Blocks.COPPER_ORE, Blocks.DEEPSLATE_COPPER_ORE)) {
            return ParticleTypes.CRIT;
        }
        if (is(state, Blocks.REDSTONE_ORE, Blocks.DEEPSLATE_REDSTONE_ORE)) {
            return ParticleTypes.GLOW;
        }
        if (is(state, Blocks.COAL_ORE, Blocks.DEEPSLATE_COAL_ORE, Blocks.ANCIENT_DEBRIS)) {
            return ParticleTypes.SMOKE;
        }
        return null;
    }

    private static boolean is(BlockState state, Block... blocks) {
        for (Block block : blocks) {
            if (state.isOf(block)) {
                return true;
            }
        }
        return false;
    }

    public OreSenseItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        int cx = (int) Math.floor(user.getX());
        int cy = (int) Math.floor(user.getY());
        int cz = (int) Math.floor(user.getZ());

        List<BlockPos> found = new ArrayList<>();
        List<ParticleEffect> colours = new ArrayList<>();
        int[] x = {-RADIUS};
        BlockPos.Mutable pos = new BlockPos.Mutable();

        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 1.0F, 1.4F);

        // Half a million blocks is too many for one tick, so the sweep is
        // budgeted the same way the craters are. It finishes in a few ticks and
        // nobody notices the delay.
        Scheduler.repeat(() -> {
            int budget = SCAN_PER_TICK;
            while (budget > 0) {
                if (x[0] > RADIUS || found.size() >= MAX_FOUND) {
                    show(serverWorld, user, found, colours, 0);
                    return false;
                }
                for (int y = -RADIUS; y <= RADIUS; y++) {
                    for (int z = -RADIUS; z <= RADIUS; z++) {
                        pos.set(cx + x[0], cy + y, cz + z);
                        ParticleEffect colour = colourOf(serverWorld.getBlockState(pos));
                        if (colour != null && found.size() < MAX_FOUND) {
                            found.add(pos.toImmutable());
                            colours.add(colour);
                        }
                    }
                }
                budget -= (2 * RADIUS + 1) * (2 * RADIUS + 1);
                x[0]++;
            }
            return true;
        });

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private void show(ServerWorld world, PlayerEntity user,
                      List<BlockPos> found, List<ParticleEffect> colours, int age) {
        if (age == 0) {
            user.sendMessage(Text.literal(found.isEmpty()
                    ? "§7◇ no ore within " + RADIUS + " blocks"
                    : "§b◇ ORE SENSE — " + found.size() + " ores lit"), true);
            if (found.isEmpty()) {
                return;
            }
        }
        if (age > SHOW_TICKS) {
            return;
        }
        for (int i = 0; i < found.size(); i++) {
            BlockPos at = found.get(i);
            world.spawnParticles(colours.get(i),
                    at.getX() + 0.5, at.getY() + 0.5, at.getZ() + 0.5, 2, 0.2, 0.2, 0.2, 0.0);
        }
        // Re-drawn every half second rather than continuously: particles are
        // short-lived, and this keeps the veins visible without sending the
        // client thousands of them every tick.
        Scheduler.after(PULSE_EVERY, () -> show(world, user, found, colours, age + PULSE_EVERY));
    }
}
