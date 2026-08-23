package net.fabricmc.fabric.api.entity.event.v1;

import net.minecraft.entity.LivingEntity;

public final class ServerLivingEntityEvents {
    public static final Event<AfterDeath> AFTER_DEATH = new Event<>();

    public interface AfterDeath { void afterDeath(LivingEntity entity, Object damageSource); }

    public static final class Event<T> { public void register(T listener) {} }
}
