package net.minecraft.server.command;

import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.mojang.brigadier.builder.RequiredArgumentBuilder;

public final class CommandManager {
    public static LiteralArgumentBuilder<ServerCommandSource> literal(String name) { return null; }
    public static <T> RequiredArgumentBuilder<ServerCommandSource, T> argument(String name, T type) {
        return null;
    }
}
