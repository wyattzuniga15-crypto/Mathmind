package net.minecraft.entity.player;

import net.minecraft.entity.LivingEntity;
import net.minecraft.item.ItemCooldownManager;
import net.minecraft.item.ItemStack;
import net.minecraft.text.Text;
import net.minecraft.util.Hand;
public class PlayerEntity extends LivingEntity {
    public net.minecraft.text.Text getName() { return null; }
    public void sendMessage(Text text, boolean actionBar) {}
    public ItemStack getStackInHand(Hand hand) { return null; }
    public ItemCooldownManager getItemCooldownManager() { return null; }
}
