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

/** Boils away every drop of water and pool of lava within forty blocks. */
public class VaporiseItem extends Item {
    private static final int RADIUS = 40;
    private static final int COOLDOWN = 200;

    public VaporiseItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 130.0);
        user.sendMessage(Text.literal("§c♨ Boiling it off."), true);
        Area.ball(serverWorld, at, RADIUS, (w, pos, was, dx, dy, dz) ->
                (was.isOf(Blocks.WATER) || was.isOf(Blocks.LAVA))
                        ? Blocks.AIR.getDefaultState() : null,
                () -> user.sendMessage(Text.literal("§c♨ Dry."), true));
        serverWorld.spawnParticles(ParticleTypes.CLOUD, true, true,
                at.x, at.y + 3, at.z, 500, RADIUS * 0.4, 4.0, RADIUS * 0.4, 0.1);
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
