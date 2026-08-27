package net.minecraft.sound;

import net.minecraft.registry.entry.RegistryEntry;

// Which of these is a bare SoundEvent and which is a RegistryEntry.Reference
// is not guessable — ENTITY_GENERIC_EXPLODE is a Reference and needs value()
// before ServerWorld.playSound will take it, while ENTITY_CAT_HISS sitting
// right beside it is bare. Both of these were confirmed by a real build, and
// the workflow now dumps the true type of every sound the mod names, so the
// next one is read off the build rather than assumed.
public class SoundEvents {
    public static final SoundEvent ENTITY_WITHER_SPAWN = new SoundEvent();
    public static final SoundEvent BLOCK_NOTE_BLOCK_BASS = new SoundEvent();
    public static final SoundEvent ENTITY_EXPERIENCE_ORB_PICKUP = new SoundEvent();
    public static final SoundEvent ENTITY_WARDEN_SONIC_BOOM = new SoundEvent();
    public static final SoundEvent ENTITY_CAT_HISS = new SoundEvent();
    public static final SoundEvent ENTITY_CAT_PURREOW = new SoundEvent();
    public static final RegistryEntry.Reference<SoundEvent> ENTITY_GENERIC_EXPLODE =
            new RegistryEntry.Reference<>();
}
