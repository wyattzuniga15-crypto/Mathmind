package net.minecraft.registry;

import net.minecraft.item.Item;

public class Registry {
    public static Item register(Object registry, RegistryKey<Item> key, Item value) { return value; }
    public static <T> T register(Object registry, RegistryKey<?> key, T value) { return value; }
}
