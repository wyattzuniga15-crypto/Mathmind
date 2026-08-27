package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
import net.minecraft.block.Blocks;
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

/** Sets a wide circle of ground alight, and leaves it burning. */
public class NapalmLauncherItem extends ArsenalItem {
    private static final int RADIUS = 22;
    private static final int COOLDOWN = 160;

    public NapalmLauncherItem(Settings settings) {
        super(settings, "Sets a wide circle of ground alight, and leaves it burning.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 140.0);
        user.sendMessage(Text.literal("§6🔥 NAPALM"), true);
        serverWorld.playSound(null, BlockPos.ofFloored(at), SoundEvents.ENTITY_GENERIC_EXPLODE.value(),
                SoundCategory.MASTER, 40.0F, 0.6F);
        // Only the block sitting on top of something solid is lit: fire placed in
        // open air vanishes on the next tick and the whole thing looks like a dud.
        Area.column(serverWorld, at, RADIUS, 12, 12, (w, pos, was, dx, dy, dz) -> {
            if (!was.isAir()) {
                return null;
            }
            return w.getBlockState(pos.down()).isAir() ? null : Blocks.FIRE.getDefaultState();
        }, () -> user.sendMessage(Text.literal("§6🔥 It will burn for a while."), true));
        serverWorld.spawnParticles(ParticleTypes.FLAME, true, true,
                at.x, at.y + 2, at.z, 400, RADIUS * 0.5, 2.0, RADIUS * 0.5, 0.1);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
