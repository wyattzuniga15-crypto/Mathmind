package com.orbital.arsenal.items;

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

/** Dissolves a sphere of world into nothing at all. No crater lip, no debris — the blocks simply stop existing. */
public class DisintegratorItem extends Item {
    private static final int RADIUS = 20;
    private static final int COOLDOWN = 120;

    public DisintegratorItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 140.0);
        user.sendMessage(Text.literal("§d☢ DISINTEGRATE"), true);
        serverWorld.playSound(null, BlockPos.ofFloored(at), SoundEvents.ENTITY_WARDEN_SONIC_BOOM,
                SoundCategory.MASTER, 8.0F, 1.9F);
        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                at.x, at.y, at.z, 400, RADIUS * 0.5, RADIUS * 0.5, RADIUS * 0.5, 0.1);
        // No explosion: this is the point of it. An explosion throws debris and
        // leaves a rim, and what people ask for here is a clean bite out of the world.
        Area.ball(serverWorld, at, RADIUS,
                (w, pos, was, dx, dy, dz) -> Blocks.AIR.getDefaultState(),
                () -> user.sendMessage(Text.literal("§d☢ Gone."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
