package com.orbital.arsenal.items;

import com.orbital.arsenal.Scheduler;
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

/** Buries a lit stone dungeon under you, with a shaft down into it. */
public class DungeonMakerItem extends Item {
    private static final int W = 14;
    private static final int H = 6;
    private static final int DROP = 18;
    private static final int COOLDOWN = 300;

    public DungeonMakerItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int floor = (int) Math.floor(user.getY()) - DROP;
        user.sendMessage(Text.literal("§8▤ Something under your feet."), true);
        Area.sweep(serverWorld, new Vec3d(cx, floor + H / 2.0, cz), W, H, W,
                (dx, dy, dz) -> true,
                (w, pos, was, dx, dy, dz) -> {
                    boolean shell = Math.abs(dx) == W || Math.abs(dz) == W
                            || Math.abs(dy) == H;
                    if (shell) {
                        return Blocks.STONE_BRICKS.getDefaultState();
                    }
                    // Lamps on a grid inside, then air: a dark room underground is
                    // indistinguishable from no room at all.
                    if (dy == H - 1 && Math.abs(dx) % 6 == 0 && Math.abs(dz) % 6 == 0) {
                        return Blocks.GLOWSTONE.getDefaultState();
                    }
                    return Blocks.AIR.getDefaultState();
                },
                () -> {
                    // The way in, cut after the room exists so it is not filled in.
                    for (int y = floor + H; y <= floor + H + DROP + 2; y++) {
                        BlockPos shaft = new BlockPos(cx, y, cz);
                        BlockState was = serverWorld.getBlockState(shaft);
                        if (!was.isAir() && !was.isOf(Blocks.BEDROCK)) {
                            Journal.clear(serverWorld, shaft, was, Blocks.AIR.getDefaultState());
                        }
                    }
                    user.sendMessage(Text.literal("§8▤ Shaft is open. Down you go."), true);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
