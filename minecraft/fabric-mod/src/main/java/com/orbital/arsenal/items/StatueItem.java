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

/** Raises a blocky twenty-block statue of you, where you stand. */
public class StatueItem extends Item {
    private static final int LEGS = 8;
    private static final int TORSO = 18;
    private static final int TOP = 24;
    private static final int COOLDOWN = 400;

    public StatueItem(Settings settings) {
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
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_NOTE_BLOCK_BASS.value(),
                SoundCategory.MASTER, 3.0F, 0.7F);
        user.sendMessage(Text.literal("§6☗ Hold still."), true);
        Area.sweep(serverWorld, new Vec3d(cx, base, cz), 8, TOP, 8,
                (dx, dy, dz) -> dy >= 0 && dy <= TOP,
                StatueItem::paint,
                () -> user.sendMessage(Text.literal("§6☗ Immortalised."), true));
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    /**
     * The player, three times life size, in the proportions the vanilla model
     * uses: legs to the waist, a torso half as tall again, arms at the sides,
     * and a head one unit cubed on top.
     */
    private static BlockState paint(net.minecraft.server.world.ServerWorld world,
            BlockPos pos, BlockState was, int dx, int dy, int dz) {
        // Legs: two, with a gap between them.
        if (dy < LEGS) {
            if (Math.abs(dx) >= 1 && Math.abs(dx) <= 2 && Math.abs(dz) <= 1) {
                return Blocks.STONE_BRICKS.getDefaultState();
            }
            return null;
        }
        // Torso.
        if (dy < TORSO) {
            if (Math.abs(dx) <= 2 && Math.abs(dz) <= 1) {
                return Blocks.STONE_BRICKS.getDefaultState();
            }
            // Arms, one block clear of the torso on each side.
            if (Math.abs(dx) == 4 && Math.abs(dz) <= 1) {
                return Blocks.CUT_SANDSTONE.getDefaultState();
            }
            return null;
        }
        if (dy <= TOP && Math.abs(dx) <= 2 && Math.abs(dz) <= 2) {
            return Blocks.CUT_SANDSTONE.getDefaultState();
        }
        return null;
    }
}
