package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
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

/** Freezes everything in sight: snow on the ground, ice on the water. */
public class IceAgeItem extends Item {
    private static final int RADIUS = 44;
    private static final int COOLDOWN = 300;

    public IceAgeItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 140.0);
        user.sendMessage(Text.literal("§b❆ Winter."), true);
        serverWorld.playSound(null, BlockPos.ofFloored(at), SoundEvents.BLOCK_GLASS_BREAK,
                SoundCategory.MASTER, 10.0F, 0.4F);
        // Water becomes ice and exposed ground gets a layer of snow. Anything with
        // air above it is a surface; anything buried is left alone, because a solid
        // ball of snow is a snowball, not a winter.
        Area.column(serverWorld, at, RADIUS, 30, 30, (w, pos, was, dx, dy, dz) -> {
            if (was.isOf(Blocks.WATER)) {
                return Blocks.PACKED_ICE.getDefaultState();
            }
            if (!was.isAir() && w.getBlockState(pos.up()).isAir()) {
                return Blocks.SNOW_BLOCK.getDefaultState();
            }
            return null;
        }, () -> user.sendMessage(Text.literal("§b❆ Frozen over."), true));
        serverWorld.spawnParticles(ParticleTypes.SNOWFLAKE, true, true,
                at.x, at.y + 8, at.z, 600, RADIUS * 0.5, 6.0, RADIUS * 0.5, 0.05);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
