package net.minecraft.server.command;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

public class ServerCommandSource {
    public ServerPlayerEntity getPlayer() { return null; }
    public MinecraftServer getServer() { return null; }
    public net.minecraft.server.world.ServerWorld getWorld() { return null; }
}
