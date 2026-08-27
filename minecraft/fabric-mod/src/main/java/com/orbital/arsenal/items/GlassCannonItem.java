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

/** Turns everything in a wide sphere to glass. It stays standing, and one hit brings the lot down. */
public class GlassCannonItem extends ArsenalItem {
    private static final int RADIUS = 24;
    private static final int COOLDOWN = 200;

    public GlassCannonItem(Settings settings) {
        super(settings, "Turns everything in a wide sphere to glass. It stays standing, and one hit brings the lot down.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 140.0);
        user.sendMessage(Text.literal("§b◇ GLASS"), true);
        serverWorld.playSound(null, BlockPos.ofFloored(at), SoundEvents.BLOCK_GLASS_BREAK,
                SoundCategory.MASTER, 10.0F, 1.4F);
        // Air stays air. Turning the sky to glass would seal the crater shut.
        Area.ball(serverWorld, at, RADIUS, (w, pos, was, dx, dy, dz) ->
                was.isAir() ? null : Blocks.GLASS.getDefaultState(),
                () -> user.sendMessage(Text.literal("§b◇ Do not lean on it."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
