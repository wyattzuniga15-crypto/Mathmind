package net.minecraft.entity.boss;

import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

public class ServerBossBar extends BossBar {
    public ServerBossBar(Text name, Color colour, Style style) {}
    public void setPercent(float percent) {}
    public void addPlayer(ServerPlayerEntity player) {}
    public void removePlayer(ServerPlayerEntity player) {}
    public void clearPlayers() {}
}
