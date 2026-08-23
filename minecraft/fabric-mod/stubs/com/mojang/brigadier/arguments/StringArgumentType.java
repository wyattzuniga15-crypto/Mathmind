package com.mojang.brigadier.arguments;

import com.mojang.brigadier.context.CommandContext;

public final class StringArgumentType {
    public static StringArgumentType greedyString() { return null; }
    public static String getString(CommandContext<?> context, String name) { return ""; }
}
