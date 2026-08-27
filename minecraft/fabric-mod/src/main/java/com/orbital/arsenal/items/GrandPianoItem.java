package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Sculpture;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** The oldest joke there is: a grand piano, from a great height. */
public class GrandPianoItem extends ArsenalItem {
    public GrandPianoItem(Settings settings) {
        super(settings, "The oldest joke there is: a grand piano, from a great height.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d target = Strikes.aim(user, 150.0);
        Sculpture.drop(serverWorld, user, target, GrandPianoItem::paint, 14, 90,
                "GRAND PIANO", (w, u, at) -> {
                    Sculpture.boom(w, at, 7.0F, 200);
                    // The whole point is the noise it makes on the way out.
                    w.playSound(null, BlockPos.ofFloored(at), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                            SoundCategory.MASTER, 100.0F, 0.5F);
                    w.spawnParticles(ParticleTypes.NOTE, true, true,
                            at.x, at.y + 4, at.z, 200, 8.0, 4.0, 8.0, 1.0);
                    Sculpture.crater(w, at, 18, 8, null);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), 200);
        return ActionResult.SUCCESS;
    }

    private static Block paint(int x, int y, int z) {
        // Keys first: they sit on the front edge of the body, so the body
        // would cover them if it were asked about first.
        if (y >= -3 && y <= -1 && z >= 5 && z <= 7 && x >= -8 && x <= 8) {
            return ((x + 8) % 2 == 0) ? Blocks.BLACK_CONCRETE : Blocks.WHITE_CONCRETE;
        }
        // A grand piano's outline: wide at the keyboard, curving to a point.
        if (y >= -5 && y <= 0 && Sculpture.blob(x, 0, z, 0, 0, 0, 10, 1, 7)
                && !(x > 3 && z > 3)) {
            return Blocks.BLACK_CONCRETE;
        }
        // The lid, propped open — hinged low at the back and raised in front.
        if (y > 0 && y <= 5 && Math.abs(z - (y - 2.5)) < 1.2 && x >= -9 && x <= 9) {
            return Blocks.BLACK_CONCRETE;
        }
        for (int lx = -1; lx <= 1; lx += 2) {
            for (int lz = -1; lz <= 1; lz += 2) {
                if (Sculpture.post(x, z, lx * 7, lz * 5, 1.2) && y >= -9 && y < -5) {
                    return Blocks.BLACK_CONCRETE;
                }
            }
        }
        return null;
    }
}
