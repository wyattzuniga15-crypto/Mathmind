package net.minecraft.entity;

import net.minecraft.entity.mob.MobEntity;
import net.minecraft.world.World;

// T is bounded by Entity in the real class; without that bound here,
// create() on an EntityType<?> yields a capture that is not an Entity.
public class EntityType<T extends Entity> {
    public static final EntityType<MobEntity> ALLAY = new EntityType<>();
    public T create(World world, SpawnReason reason) { return null; }
}
