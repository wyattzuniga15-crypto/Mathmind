package com.orbital.arsenal.companion;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

/**
 * Who a tool call is acting for.
 *
 * The SDK builds tool objects itself, so they cannot be handed a player
 * through a constructor. Each request already runs on its own background
 * thread, which makes a thread local the natural place to put this: set once
 * when the request starts, read by whichever tools the model decides to call,
 * cleared when it ends.
 */
final class Conversation {
    private static final ThreadLocal<Conversation> CURRENT = new ThreadLocal<>();

    final ServerPlayerEntity player;
    final MinecraftServer server;

    private Conversation(ServerPlayerEntity player, MinecraftServer server) {
        this.player = player;
        this.server = server;
    }

    static void begin(ServerPlayerEntity player, MinecraftServer server) {
        CURRENT.set(new Conversation(player, server));
    }

    static void end() {
        CURRENT.remove();
    }

    static Conversation current() {
        return CURRENT.get();
    }
}
