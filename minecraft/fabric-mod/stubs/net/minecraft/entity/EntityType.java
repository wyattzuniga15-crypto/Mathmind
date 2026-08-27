package net.minecraft.entity;

import net.minecraft.entity.mob.MobEntity;
import net.minecraft.registry.RegistryKey;
import net.minecraft.world.World;

public class EntityType<T extends Entity> {
    public static final EntityType<MobEntity> CAT = new EntityType<>();
    public static final EntityType<MobEntity> IRON_GOLEM = new EntityType<>();
    public static final EntityType<Entity> LIGHTNING_BOLT = new EntityType<>();
    public static final EntityType<MobEntity> ALLAY = new EntityType<>();
    public static final EntityType<MobEntity> VEX = new EntityType<>();
    public static final EntityType<MobEntity> RAVAGER = new EntityType<>();
    public static final EntityType<LivingEntity> ARMOR_STAND = new EntityType<>();

    public T create(World world, SpawnReason reason) { return null; }

    public interface EntityFactory<T extends Entity> { T create(EntityType<T> type, World world); }

    public static class Builder<T extends Entity> {
        public static <T extends Entity> Builder<T> create(EntityFactory<T> factory, SpawnGroup group) {
            return new Builder<>();
        }
        public Builder<T> dimensions(float width, float height) { return this; }
        public EntityType<T> build(RegistryKey<EntityType<?>> key) { return new EntityType<>(); }
    }
}
