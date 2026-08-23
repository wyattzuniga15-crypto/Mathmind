package net.fabricmc.fabric.api.event.lifecycle.v1;

import net.minecraft.server.MinecraftServer;

public class ServerTickEvents {
    public interface EndTick { void onEndTick(MinecraftServer server); }
    public static class Event { public void register(EndTick handler) {} }
    public static final Event END_SERVER_TICK = new Event();
}
