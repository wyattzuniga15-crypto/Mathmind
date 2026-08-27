package com.orbital.arsenal.items;

import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
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

/** Fills in every hole around you, back to solid ground. */
public class RepairItem extends Item {
    private static final int RADIUS = 24;
    private static final int DEPTH = 24;
    private static final int COOLDOWN = 200;

    public RepairItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int stand = (int) Math.floor(user.getY());
        user.sendMessage(Text.literal("§7✚ Filling in."), true);
        // Ground level is read from the rim, where nothing has been dug, and
        // that is the level the holes come back up to. Filling every air block
        // that has something solid under it instead walls the sweep in solid
        // from the floor up — including around the player, who is standing in
        // the middle of it.
        int level = Integer.MIN_VALUE;
        for (int step = 0; step < 32; step++) {
            double a = step * Math.PI / 16.0;
            int rx = cx + (int) Math.round(Math.cos(a) * RADIUS);
            int rz = cz + (int) Math.round(Math.sin(a) * RADIUS);
            level = Math.max(level, Area.surface(serverWorld, rx, rz, stand));
        }
        // Never at or above the player's own feet, so standing in the pit you
        // are mending does not entomb you in it.
        int top = Math.min(level, stand - 1);
        int[] filled = {0};
        Area.column(serverWorld, new Vec3d(cx, top, cz), RADIUS, 0, DEPTH,
                (w, pos, was, dx, dy, dz) -> {
                    if (!was.isAir()) {
                        return null;
                    }
                    filled[0]++;
                    return Blocks.STONE.getDefaultState();
                },
                () -> user.sendMessage(Text.literal("§7✚ Filled " + filled[0] + " blocks."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
