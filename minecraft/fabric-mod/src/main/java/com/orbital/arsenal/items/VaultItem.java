package com.orbital.arsenal.items;

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

/** Seals an obsidian room under your feet, with a chest waiting in it. */
public class VaultItem extends Item {
    private static final int HALF = 5;
    private static final int DROP = 12;
    private static final int COOLDOWN = 400;

    public VaultItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        int cx = (int) Math.floor(user.getX());
        int cz = (int) Math.floor(user.getZ());
        int roof = (int) Math.floor(user.getY()) - DROP;
        user.sendMessage(Text.literal("§8▣ Twelve blocks down."), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_WITHER_SPAWN,
                SoundCategory.MASTER, 3.0F, 1.4F);
        Area.sweep(serverWorld, new Vec3d(cx, roof, cz), HALF, HALF, HALF,
                (dx, dy, dz) -> true,
                VaultItem::paint,
                () -> user.sendMessage(
                        Text.literal("§8▣ Sealed. You will need a pickaxe."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static BlockState paint(net.minecraft.server.world.ServerWorld world,
            BlockPos pos, BlockState was, int dx, int dy, int dz) {
        int edge = Math.max(Math.max(Math.abs(dx), Math.abs(dy)), Math.abs(dz));
        if (edge == HALF) {
            return Blocks.OBSIDIAN.getDefaultState();
        }
        if (dx == 0 && dz == 0 && dy == -HALF + 1) {
            return Blocks.CHEST.getDefaultState();
        }
        if (dy == -HALF + 1 && Math.abs(dx) + Math.abs(dz) == 3) {
            return Blocks.SEA_LANTERN.getDefaultState();
        }
        return Blocks.AIR.getDefaultState();
    }
}
