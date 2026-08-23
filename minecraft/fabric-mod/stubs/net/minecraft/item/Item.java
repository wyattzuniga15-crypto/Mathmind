package net.minecraft.item;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.registry.RegistryKey;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;
public class Item {
    public static class Settings {
        public Settings registryKey(RegistryKey<Item> key) { return this; }
        public Settings maxCount(int n) { return this; }
    }
    public Item(Settings settings) {}
    public ActionResult use(World world, PlayerEntity user, Hand hand) { return ActionResult.SUCCESS; }
}
