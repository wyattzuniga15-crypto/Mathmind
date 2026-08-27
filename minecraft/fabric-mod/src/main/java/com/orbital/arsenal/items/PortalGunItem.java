package com.orbital.arsenal.items;

import com.orbital.arsenal.portal.Portals;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * The Aperture Science Handheld Portal Device, more or less.
 *
 * Right-click a surface for the blue portal, crouch and right-click for the
 * orange one. Once both are up, walking into either puts you out of the other
 * carrying the speed you arrived with — see Portals for why that is the whole
 * point rather than a detail.
 *
 * Two portals rather than one per click, and they are per player, so two people
 * with portal guns do not fire into each other's pairs.
 *
 * Fired at a surface rather than into the air on purpose: a portal needs a wall
 * to sit on, and one hanging in mid-air with nothing behind it reads as a bug
 * even when it works.
 */
public class PortalGunItem extends ArsenalItem {
    private static final double RANGE = 64.0;
    private static final int COOLDOWN = 8;

    public PortalGunItem(Settings settings) {
        super(settings, "The Aperture Science Handheld Portal Device, more or less.");
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        HitResult hit = user.raycast(RANGE, 1.0F, false);
        if (!(hit instanceof BlockHitResult block) || hit.getType() != HitResult.Type.BLOCK) {
            user.sendMessage(Text.literal("§7no surface in range"), true);
            return ActionResult.SUCCESS;
        }

        boolean orange = user.isSneaking();
        Vec3d normal = Portals.normalOf(block.getSide());
        // Sit the ring a little off the wall so it is not buried in the block
        // it is attached to.
        Vec3d at = hit.getPos().add(normal.multiply(0.6));

        Portals.place(user, orange, new Portals.Portal(at, normal, serverWorld));

        String colour = orange ? "§6orange" : "§9blue";
        user.sendMessage(Text.literal(Portals.linked(user)
                ? colour + " portal placed §7— the pair is open"
                : colour + " portal placed §7— place the other one"), true);
        serverWorld.playSound(null, user.getBlockPos(), SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
                SoundCategory.MASTER, 0.8F, orange ? 1.4F : 1.9F);

        ItemStack stack = user.getStackInHand(hand);
        user.getItemCooldownManager().set(stack, COOLDOWN);
        return ActionResult.SUCCESS;
    }
}
