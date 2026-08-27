package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
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

/** A briefcase bomb. Ten seconds of counting, and then a very large hole. */
public class NukeSuitcaseItem extends Item {
    private static final int FUSE = 200;
    private static final int RADIUS = 46;
    private static final int COOLDOWN = 600;

    public NukeSuitcaseItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = new Vec3d(user.getX(), user.getY(), user.getZ());
        user.sendMessage(Text.literal("§c☢ TEN SECONDS. RUN."), false);
        int[] age = {0};
        Scheduler.repeat(() -> {
            age[0]++;
            if (age[0] % 20 == 0 && age[0] < FUSE) {
                int left = (FUSE - age[0]) / 20;
                // Counted down out loud, because a bomb you cannot hear ticking is
                // just a delayed explosion.
                user.sendMessage(Text.literal("§c☢ " + left), true);
                serverWorld.playSound(null, BlockPos.ofFloored(at),
                        SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP, SoundCategory.MASTER, 4.0F, 0.5F);
            }
            if (age[0] < FUSE) {
                serverWorld.spawnParticles(ParticleTypes.SMOKE, true, true,
                        at.x, at.y + 0.5, at.z, 2, 0.2, 0.1, 0.2, 0.0);
                return true;
            }
            Strikes.blast(serverWorld, at.add(0, 2, 0), 30.0F);
            serverWorld.spawnParticles(ParticleTypes.LARGE_SMOKE, true, true,
                    at.x, at.y + 20, at.z, 800, 20.0, 20.0, 20.0, 0.3);
            Area.ball(serverWorld, at, RADIUS,
                    (w, pos, was, dx, dy, dz) -> Blocks.AIR.getDefaultState(),
                    () -> user.sendMessage(Text.literal("§c☢ Nothing left."), true));
            return false;
        });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
