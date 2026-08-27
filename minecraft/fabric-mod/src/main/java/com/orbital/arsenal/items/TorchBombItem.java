package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
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

/** Scatters two hundred torches over the ground and walls around you. No more dark corners. */
public class TorchBombItem extends Item {
    private static final int REACH = 24;
    private static final int TORCHES = 200;
    private static final int PER_TICK = 12;
    private static final int COOLDOWN = 200;

    public TorchBombItem(Settings settings) {
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
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§e✷ Light."), true);
        int[] placed = {0};
        int[] tries = {0};
        Scheduler.repeat(() -> {
            ThreadLocalRandom dice = ThreadLocalRandom.current();
            for (int n = 0; n < PER_TICK; n++) {
                // Bounded by attempts as well as by torches: in open air almost
                // nothing has a floor under it, and without this the loop would
                // spin for ever looking for two hundred places that do not exist.
                if (placed[0] >= TORCHES || ++tries[0] > TORCHES * 40) {
                    user.sendMessage(Text.literal("§e✷ " + placed[0] + " torches."), true);
                    return false;
                }
                int x = cx + dice.nextInt(-REACH, REACH + 1);
                int y = cy + dice.nextInt(-REACH / 2, REACH / 2 + 1);
                int z = cz + dice.nextInt(-REACH, REACH + 1);
                BlockPos spot = new BlockPos(x, y, z);
                BlockState was = serverWorld.getBlockState(spot);
                if (!was.isAir() || serverWorld.getBlockState(spot.down()).isAir()) {
                    continue;
                }
                Journal.clear(serverWorld, spot, was, Blocks.TORCH.getDefaultState());
                placed[0]++;
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
