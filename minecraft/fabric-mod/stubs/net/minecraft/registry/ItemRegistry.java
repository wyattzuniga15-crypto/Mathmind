package net.minecraft.registry;

import net.minecraft.item.Item;
import net.minecraft.util.Identifier;

/** Stands in for the item registry's get(Identifier); the real one is generic. */
public class ItemRegistry {
    public Item get(Identifier id) { return null; }
}
