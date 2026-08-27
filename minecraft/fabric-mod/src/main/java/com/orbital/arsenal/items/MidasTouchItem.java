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

/** Everything within twenty blocks becomes solid gold. Including, unfortunately, the trees. */
public class MidasTouchItem extends Item {
    private static final int RADIUS = 20;
    private static final int COOLDOWN = 300;

    public MidasTouchItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 120.0);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_GENERIC_EXPLODE.value(),
                SoundCategory.MASTER, 4.0F, 1.2F);
        user.sendMessage(Text.literal("§e✦ Gold."), true);
        serverWorld.spawnParticles(ParticleTypes.END_ROD, true, true,
                at.x, at.y + 3, at.z, 400, RADIUS * 0.5, RADIUS * 0.4, RADIUS * 0.5, 0.06);
        Area.ball(serverWorld, at, RADIUS, (w, pos, was, dx, dy, dz) ->
                was.isAir() ? null : Blocks.GOLD_BLOCK.getDefaultState(),
                () -> user.sendMessage(Text.literal("§e✦ Rich, and stuck."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
