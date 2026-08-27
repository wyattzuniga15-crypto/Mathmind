package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
import java.util.concurrent.ThreadLocalRandom;
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

/** Buries everything nearby under moss and leaves, as if it had been left alone for a century. */
public class OvergrowthItem extends Item {
    private static final int RADIUS = 28;
    private static final int COOLDOWN = 300;

    public OvergrowthItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 130.0);
        user.sendMessage(Text.literal("§2❦ A hundred years, all at once."), true);
        // Surfaces only, and mottled rather than uniform — an evenly mossed
        // landscape reads as painted, a patchy one reads as grown.
        Area.column(serverWorld, at, RADIUS, 30, 20, (w, pos, was, dx, dy, dz) -> {
            if (was.isAir() || !w.getBlockState(pos.up()).isAir()) {
                return null;
            }
            int n = Math.floorMod(dx * 7 + dz * 13 + dy * 3, 10);
            if (n < 5) {
                return Blocks.MOSS_BLOCK.getDefaultState();
            }
            return n < 8 ? Blocks.OAK_LEAVES.getDefaultState() : null;
        }, () -> user.sendMessage(Text.literal("§2❦ Overgrown."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
