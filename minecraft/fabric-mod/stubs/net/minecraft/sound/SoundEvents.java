package net.minecraft.sound;

import net.minecraft.registry.entry.RegistryEntry;

public class SoundEvents {
    public static final SoundEvent ENTITY_WITHER_SPAWN = new SoundEvent();
    public static final SoundEvent ENTITY_EXPERIENCE_ORB_PICKUP = new SoundEvent();
    public static final SoundEvent ENTITY_WARDEN_SONIC_BOOM = new SoundEvent();
    public static final SoundEvent ENTITY_GENERIC_EXPLODE = new SoundEvent();
    public static final RegistryEntry.Reference<SoundEvent> ENTITY_CAT_HISS =
            new RegistryEntry.Reference<>();
    public static final RegistryEntry.Reference<SoundEvent> ENTITY_CAT_PURREOW =
            new RegistryEntry.Reference<>();
}
