package net.minecraft.server.network;

import com.mojang.authlib.GameProfile;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;

public class ServerPlayerEntity extends PlayerEntity {
    public ServerWorld getEntityWorld() { return null; }
    public GameProfile getGameProfile() { return null; }
    public void giveItemStack(ItemStack stack) {}
    public void sendMessage(Text text, boolean actionBar) {}
    public boolean isRemoved() { return false; }
}
