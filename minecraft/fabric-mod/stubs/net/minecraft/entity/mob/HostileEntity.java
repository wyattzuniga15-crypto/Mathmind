package net.minecraft.entity.mob;

import net.minecraft.entity.EntityType;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.world.World;

public abstract class HostileEntity extends PathAwareEntity {
    protected HostileEntity(EntityType<? extends HostileEntity> type, World world) {}
    public static DefaultAttributeContainer.Builder createHostileAttributes() {
        return DefaultAttributeContainer.builder();
    }
}
