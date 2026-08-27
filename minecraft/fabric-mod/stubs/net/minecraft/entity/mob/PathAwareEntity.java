package net.minecraft.entity.mob;

import net.minecraft.entity.EntityType;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.world.World;

public class PathAwareEntity extends MobEntity {
    protected PathAwareEntity() {}
    protected PathAwareEntity(EntityType<? extends PathAwareEntity> type, World world) {}
    public static DefaultAttributeContainer.Builder createMobAttributes() { return null; }
}
