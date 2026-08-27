package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.player.PlayerEntity;
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

/** Everything at once: fireworks, a disco floor, confetti, and chickens. */
public class PartyModeItem extends ArsenalItem {
    private static final int DURATION = 900;
    private static final int COOLDOWN = 600;

    public PartyModeItem(Settings settings) {
        super(settings, "Everything at once: fireworks, a disco floor, confetti, and chickens.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int ground = Area.surface(serverWorld, cx, cz, (int) user.getY());
        Block[] colours = {Blocks.RED_CONCRETE, Blocks.ORANGE_CONCRETE, Blocks.YELLOW_CONCRETE,
                Blocks.PINK_CONCRETE, Blocks.WHITE_CONCRETE};
        user.sendMessage(Text.literal("§d✹ PARTY"), false);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION || user.isRemoved()) {
                user.sendMessage(Text.literal("§7✹ Party over."), true);
                return false;
            }
            ThreadLocalRandom dice = ThreadLocalRandom.current();
            // Each strand on its own beat, and none of them on the same one: all
            // firing together lands as a single thump every second rather than a
            // party going on around you.
            if (age[0] % 4 == 0) {
                for (int x = -8; x <= 8; x++) {
                    for (int z = -8; z <= 8; z++) {
                        if (x * x + z * z > 64) {
                            continue;
                        }
                        int band = (int) (Math.sqrt(x * x + z * z) + age[0] / 4.0);
                        BlockPos tile = new BlockPos(cx + x, ground, cz + z);
                        BlockState becomes = colours[Math.floorMod(band, colours.length)]
                                .getDefaultState();
                        BlockState was = serverWorld.getBlockState(tile);
                        if (was != becomes) {
                            Journal.clear(serverWorld, tile, was, becomes);
                        }
                    }
                }
            }
            if (age[0] % 17 == 0) {
                double bx = user.getX() + dice.nextDouble(-18, 18);
                double bz = user.getZ() + dice.nextDouble(-18, 18);
                double by = user.getY() + 20 + dice.nextDouble(10);
                serverWorld.spawnParticles(ParticleTypes.FLAME, true, true,
                        bx, by, bz, 80, 3.0, 3.0, 3.0, 0.25);
                serverWorld.playSound(null, BlockPos.ofFloored(bx, by, bz),
                        SoundEvents.ENTITY_GENERIC_EXPLODE.value(), SoundCategory.AMBIENT, 2.0F, 1.7F);
            }
            if (age[0] % 9 == 0) {
                serverWorld.spawnParticles(ParticleTypes.HAPPY_VILLAGER, true, true,
                        user.getX(), user.getY() + 2.5, user.getZ(), 20, 4.0, 1.5, 4.0, 0.15);
            }
            if (age[0] % 60 == 0) {
                Entity bird = EntityType.CHICKEN.create(serverWorld, SpawnReason.EVENT);
                if (bird != null) {
                    bird.setPosition(user.getX() + dice.nextDouble(-6, 6),
                            user.getY() + 18, user.getZ() + dice.nextDouble(-6, 6));
                    serverWorld.spawnEntity(bird);
                }
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
