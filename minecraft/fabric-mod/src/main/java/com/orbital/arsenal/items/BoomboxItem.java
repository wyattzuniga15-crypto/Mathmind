package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
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

/** Plays a tune, and lights up the ground in time with it. */
public class BoomboxItem extends Item {
    private static final int BARS = 32;
    private static final int COOLDOWN = 200;

    public BoomboxItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int ground = Area.surface(serverWorld, cx, cz, (int) user.getY());
        user.sendMessage(Text.literal("§d♪ ♫"), true);
        // A pentatonic scale, so any order of notes sounds deliberate. Picking
        // pitches at random off a full scale sounds like a mistake.
        float[] scale = {0.5F, 0.56F, 0.63F, 0.75F, 0.84F, 1.0F, 1.12F, 1.26F};
        int[] beat = {0};
        Scheduler.repeat(() -> {
            // The music plays wherever you are, so it has to stop when you are nowhere.
            if (++beat[0] > BARS * 8 || user.isRemoved()) {
                return false;
            }
            if (beat[0] % 8 != 0) {
                return true;
            }
            int note = (beat[0] / 8) % scale.length;
            serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                    SoundCategory.RECORDS, 3.0F, scale[note]);
            serverWorld.spawnParticles(ParticleTypes.NOTE, true, true,
                    user.getX(), user.getY() + 2.2, user.getZ(), 8, 1.0, 0.4, 1.0, 1.0);
            int r = 3 + note;
            for (int x = -r; x <= r; x++) {
                for (int z = -r; z <= r; z++) {
                    if (Math.abs(x * x + z * z - r * r) > r) {
                        continue;
                    }
                    BlockPos tile = new BlockPos(cx + x, ground, cz + z);
                    serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                            tile.getX() + 0.5, ground + 1.1, tile.getZ() + 0.5, 1, 0.0, 0.0, 0.0, 0.0);
                }
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
