package net.minecraft.item;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.registry.RegistryKey;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;
public class Item {
    /**
     * Nested, exactly as the real one is — Item$TooltipContext, not a class of
     * its own in the item package. Taken from known_tooltip_api.txt.
     */
    public interface TooltipContext {
        TooltipContext DEFAULT = null;
    }

    public static class Settings {
        public Settings registryKey(RegistryKey<Item> key) { return this; }
        public Settings maxCount(int n) { return this; }
    }
    public Item(Settings settings) {}
    public ActionResult use(World world, PlayerEntity user, Hand hand) { return ActionResult.SUCCESS; }
    public void appendTooltip(ItemStack stack, TooltipContext context,
            net.minecraft.component.type.TooltipDisplayComponent display,
            java.util.function.Consumer<net.minecraft.text.Text> lines,
            net.minecraft.item.tooltip.TooltipType type) {}
}
