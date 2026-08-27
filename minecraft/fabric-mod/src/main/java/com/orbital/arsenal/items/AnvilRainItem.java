package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Strikes;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
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

/** Two hundred anvils, from a great height, on wherever you are pointing. */
public class AnvilRainItem extends Item {
    private static final int ANVILS = 200;
    private static final int PER_TICK = 3;
    private static final double SPREAD = 18.0;
    private static final int HEIGHT = 70;
    private static final int COOLDOWN = 300;

    public AnvilRainItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 140.0);
        user.sendMessage(Text.literal("§7⬛ Look up. Then do not."), true);
        int[] sent = {0};
        Scheduler.repeat(() -> {
            ThreadLocalRandom dice = ThreadLocalRandom.current();
            for (int n = 0; n < PER_TICK && sent[0] < ANVILS; n++, sent[0]++) {
                double a = dice.nextDouble() * Math.PI * 2;
                double r = Math.sqrt(dice.nextDouble()) * SPREAD;
                int x = (int) (at.x + Math.cos(a) * r);
                int z = (int) (at.z + Math.sin(a) * r);
                int y = (int) at.y + HEIGHT + dice.nextInt(20);
                BlockPos spot = new BlockPos(x, y, z);
                BlockState was = serverWorld.getBlockState(spot);
                if (!was.isAir()) {
                    continue;
                }
                // Placed as a block, not spawned as an entity: an anvil in air falls
                // on its own, and the vanilla fall does the damage for us.
                Journal.clear(serverWorld, spot, was, Blocks.ANVIL.getDefaultState());
            }
            return sent[0] < ANVILS;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
