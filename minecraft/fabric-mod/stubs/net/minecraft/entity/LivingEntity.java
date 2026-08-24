package net.minecraft.entity;

import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.server.world.ServerWorld;

public class LivingEntity extends Entity {
    public float getHealth() { return 0.0f; }
    public float getMaxHealth() { return 0.0f; }
    public void setHealth(float health) {}
    public void kill(ServerWorld world) {}
    public boolean addStatusEffect(StatusEffectInstance effect) { return true; }
}
