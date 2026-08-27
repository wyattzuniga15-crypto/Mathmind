package com.orbital.arsenal.entity;

import net.minecraft.entity.EntityType;
import net.minecraft.entity.ai.goal.LookAroundGoal;
import net.minecraft.entity.ai.goal.LookAtEntityGoal;
import net.minecraft.entity.ai.goal.WanderAroundFarGoal;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.mob.PathAwareEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.world.World;

/** A whale that swims through the air. Entirely peaceful, and enormous. */
public class SkyWhaleEntity extends PathAwareEntity {
    public SkyWhaleEntity(EntityType<? extends PathAwareEntity> type, World world) {
        super(type, world);
    }

    public static DefaultAttributeContainer.Builder createSkyWhaleAttributes() {
        return PathAwareEntity.createMobAttributes()
                .add(EntityAttributes.MAX_HEALTH, 300.0)
                .add(EntityAttributes.MOVEMENT_SPEED, 0.14)
                .add(EntityAttributes.FOLLOW_RANGE, 48.0)
                // Something this size being knocked about by every hit would
                // read as weightless.
                .add(EntityAttributes.KNOCKBACK_RESISTANCE, 1.0);
    }

    @Override
    protected void initGoals() {
        // No target goal at all: a whale that hunted you would be a different
        // animal, and the appeal of this one is that it simply drifts past.
        this.goalSelector.add(1, new WanderAroundFarGoal(this, 0.5));
        this.goalSelector.add(2, new LookAtEntityGoal(this, PlayerEntity.class, 48.0F));
        this.goalSelector.add(3, new LookAroundGoal(this));
    }
}
