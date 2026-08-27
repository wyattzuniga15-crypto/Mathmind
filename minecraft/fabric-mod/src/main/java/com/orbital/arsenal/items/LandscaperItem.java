package com.orbital.arsenal.items;

import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.weapons.Area;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Smooths the ground around you into rolling hills instead of whatever was there. */
public class LandscaperItem extends Item {
    private static final int RADIUS = 26;
    private static final int COOLDOWN = 250;

    public LandscaperItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int base = (int) Math.floor(user.getY());
        user.sendMessage(Text.literal("§2⌒ Smoothing."), true);
        Area.column(serverWorld, new Vec3d(cx, base, cz), RADIUS, 12, 6,
                (w, pos, was, dx, dy, dz) -> {
                    // Two sine waves at different periods, which is enough to look
                    // like terrain and not enough to look like corrugated iron.
                    int want = (int) (3.0 * Math.sin(dx * 0.18) + 2.0 * Math.cos(dz * 0.25));
                    if (dy > want) {
                        return Blocks.AIR.getDefaultState();
                    }
                    return dy == want ? Blocks.GRASS_BLOCK.getDefaultState()
                            : Blocks.DIRT.getDefaultState();
                },
                () -> user.sendMessage(Text.literal("§2⌒ Rolling hills."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
