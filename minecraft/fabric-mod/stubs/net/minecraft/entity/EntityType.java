package net.minecraft.entity;

import net.minecraft.entity.mob.MobEntity;
import net.minecraft.world.World;

public class EntityType<T> {
    public static final EntityType<MobEntity> ALLAY = new EntityType<>();
    public T create(World world, SpawnReason reason) { return null; }
}
