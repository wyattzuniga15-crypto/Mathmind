package net.minecraft.server;

import net.minecraft.server.world.ServerWorld;

public class MinecraftServer {
    public void execute(Runnable task) {}
    public ServerTickManager getTickManager() { return null; }
    public Iterable<ServerWorld> getWorlds() { return java.util.List.of(); }
}
