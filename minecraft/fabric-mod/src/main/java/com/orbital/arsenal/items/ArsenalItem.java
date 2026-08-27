package com.orbital.arsenal.items;

import net.minecraft.component.type.TooltipDisplayComponent;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.tooltip.TooltipType;
import net.minecraft.text.Text;
import java.util.function.Consumer;

/**
 * Every item in the mod, so that hovering one says what it does.
 *
 * All hundred and sixty-five had a one-line description written with them —
 * it is what the field manual is built from — and none of it reached the
 * player. Holding any of them showed a name and nothing else, which for
 * something called "Foundation" or "Echo Beacon" is no help at all.
 *
 * The description is passed in rather than looked up, and the generators fill
 * it from each item's own javadoc, so the line in the game and the line on the
 * page come from the same sentence and cannot drift apart.
 *
 * The signature below is not a guess: appendTooltip has changed in almost
 * every recent version, so the workflow asks the remapped jar what it really
 * is and writes the answer into known_tooltip_api.txt beside this source.
 */
public abstract class ArsenalItem extends Item {
    private final String description;

    protected ArsenalItem(Settings settings, String description) {
        super(settings);
        this.description = description;
    }

    @Override
    public void appendTooltip(ItemStack stack, TooltipContext context,
            TooltipDisplayComponent display, Consumer<Text> lines, TooltipType type) {
        super.appendTooltip(stack, context, display, lines, type);
        // The colour code rather than Formatting: every message in this mod is
        // written with section codes already, and this keeps one convention
        // instead of two.
        lines.accept(Text.literal("§7" + description));
    }
}
