package net.fabricmc.fabric.api.command.v2;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.server.command.ServerCommandSource;

public interface CommandRegistrationCallback {
    Event EVENT = new Event();

    void register(CommandDispatcher<ServerCommandSource> dispatcher, Object registry, Object environment);

    final class Event {
        public void register(CommandRegistrationCallback callback) {}
    }
}
