package net.minecraft.entity.attribute;

import net.minecraft.registry.entry.RegistryEntry;

// Names as of 1.21.2+: the GENERIC_ prefix these once carried is gone.
public class EntityAttributes {
    public static final RegistryEntry<EntityAttribute> MAX_HEALTH = new RegistryEntry<>();
    public static final RegistryEntry<EntityAttribute> SCALE = new RegistryEntry<>();
    public static final RegistryEntry<EntityAttribute> MOVEMENT_SPEED = new RegistryEntry<>();
    public static final RegistryEntry<EntityAttribute> ATTACK_DAMAGE = new RegistryEntry<>();
    public static final RegistryEntry<EntityAttribute> FOLLOW_RANGE = new RegistryEntry<>();
    public static final RegistryEntry<EntityAttribute> KNOCKBACK_RESISTANCE = new RegistryEntry<>();
}
