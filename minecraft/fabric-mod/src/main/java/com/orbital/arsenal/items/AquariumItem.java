package com.orbital.arsenal.items;

import com.orbital.arsenal.weapons.Area;
import com.orbital.arsenal.weapons.Strikes;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/** Puts up a glass tank of water in front of you, fish included. */
public class AquariumItem extends ArsenalItem {
    private static final int HALF = 8;
    private static final int TALL = 12;
    private static final int FISH = 20;
    private static final int COOLDOWN = 300;

    public AquariumItem(Settings settings) {
        super(settings, "Puts up a glass tank of water in front of you, fish included.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }
        Vec3d at = Strikes.aim(user, 40.0);
        int cx = (int) Math.floor(at.x);
        int cy = (int) Math.floor(at.y);
        int cz = (int) Math.floor(at.z);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.BLOCK_GLASS_BREAK,
                SoundCategory.MASTER, 2.5F, 1.2F);
        user.sendMessage(Text.literal("§b▢ Filling the tank."), true);
        Area.sweep(serverWorld, new Vec3d(cx, cy, cz), HALF, TALL, HALF,
                (dx, dy, dz) -> dy >= 0 && dy <= TALL,
                AquariumItem::paint,
                () -> {
                    ThreadLocalRandom dice = ThreadLocalRandom.current();
                    // Stocked only once the tank exists. Fish put in first fall
                    // through the floor while it is still being built.
                    for (int i = 0; i < FISH; i++) {
                        Entity fish = EntityType.COD.create(serverWorld, SpawnReason.EVENT);
                        if (fish == null) {
                            continue;
                        }
                        fish.setPosition(cx + dice.nextDouble(-HALF + 2, HALF - 1),
                                cy + dice.nextDouble(2.0, TALL - 1.0),
                                cz + dice.nextDouble(-HALF + 2, HALF - 1));
                        serverWorld.spawnEntity(fish);
                    }
                    user.sendMessage(Text.literal("§b▢ " + FISH + " fish. Do not tap the glass."), true);
                });
        user.getItemCooldownManager().set(user.getStackInHand(hand), COOLDOWN);
        return ActionResult.SUCCESS;
    }

    private static BlockState paint(net.minecraft.server.world.ServerWorld world,
            BlockPos pos, BlockState was, int dx, int dy, int dz) {
        int edge = Math.max(Math.abs(dx), Math.abs(dz));
        if (edge == HALF || dy == 0 || dy == TALL) {
            // A stone kerb rather than glass at the waterline, so the tank has a
            // base and does not read as a floating cube.
            return dy == 0 ? Blocks.STONE_BRICKS.getDefaultState()
                    : Blocks.GLASS.getDefaultState();
        }
        return dy < TALL - 1 ? Blocks.WATER.getDefaultState() : Blocks.AIR.getDefaultState();
    }
}
