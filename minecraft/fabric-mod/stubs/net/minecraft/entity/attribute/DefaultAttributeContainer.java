package net.minecraft.entity.attribute;

import net.minecraft.registry.entry.RegistryEntry;

public class DefaultAttributeContainer {
    public static Builder builder() { return new Builder(); }

    public static class Builder {
        public Builder add(RegistryEntry<EntityAttribute> attribute, double value) { return this; }
        public Builder add(RegistryEntry<EntityAttribute> attribute) { return this; }
    }
}
