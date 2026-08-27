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

/** Plants a pillar of light you can see from a very long way off. */
public class BeaconItem extends Item {
    private static final int HEIGHT = 90;
    private static final int COOLDOWN = 120;

    public BeaconItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int base = Area.surface(serverWorld, cx, cz, (int) user.getY()) + 1;
        for (int y = 0; y < 4; y++) {
            BlockPos spot = new BlockPos(cx, base + y, cz);
            Journal.clear(serverWorld, spot, serverWorld.getBlockState(spot),
                    Blocks.SEA_LANTERN.getDefaultState());
        }
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§f▲ Marked."), true);
        // Particles rather than blocks for the column itself: ninety blocks of
        // glowstone would be a building, and this is a marker.
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > 2400) {
                return false;
            }
            for (int y = 4; y < HEIGHT; y += 2) {
                serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                        cx + 0.5, base + y, cz + 0.5, 1, 0.08, 0.0, 0.08, 0.0);
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
