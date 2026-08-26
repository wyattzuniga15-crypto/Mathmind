package net.minecraft.registry.entry;

public class RegistryEntry<T> {
    public T value() { return null; }

    // Sounds an entity makes are held as registry entries rather than as bare
    // SoundEvents — SoundEvents.ENTITY_CAT_HISS is a Reference, while
    // SoundEvents.ENTITY_WITHER_SPAWN is not. ServerWorld.playSound wants the
    // bare event, so those have to be unwrapped with value(). A real build
    // caught this; the stub now models it.
    public static class Reference<T> extends RegistryEntry<T> {}
}
