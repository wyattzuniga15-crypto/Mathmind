package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
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

/** Freezes a wide sheet of ground so slick that nothing standing on it can stop. */
public class BlackIceItem extends Item {
    private static final int RADIUS = 26;
    private static final int DURATION = 900;
    private static final double TOP_SPEED = 0.6;
    private static final int COOLDOWN = 250;

    public BlackIceItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 120.0);
        user.sendMessage(Text.literal("§b≈ Careful."), true);
        Area.column(serverWorld, at, RADIUS, 1, 3, (w, pos, was, dx, dy, dz) ->
                (!was.isAir() && w.getBlockState(pos.up()).isAir())
                        ? Blocks.BLUE_ICE.getDefaultState() : null, null);
        int[] age = {0};
        Scheduler.repeat(() -> {
            if (++age[0] > DURATION) {
                return false;
            }
            // Vanilla ice is slippery for players and almost nothing else. Keeping
            // the momentum of everything standing on it is what makes the sheet
            // dangerous rather than decorative.
            for (Entity thing : Area.living(serverWorld, null, at, RADIUS)) {
                if (!thing.isOnGround()) {
                    continue;
                }
                Vec3d v = thing.getVelocity();
                double speed = Math.sqrt(v.x * v.x + v.z * v.z);
                if (speed < 1.0E-4) {
                    continue;
                }
                // Give back what friction just took, up to a walking pace, and
                // no further. Adding a fraction of the current velocity instead
                // compounds: 1.35x a tick reaches several hundred blocks a
                // second inside two seconds, which fires mobs into the sky.
                double want = Math.min(speed * 1.35, TOP_SPEED);
                thing.setVelocity(new Vec3d(v.x / speed * want, v.y, v.z / speed * want));
            }
            return true;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
