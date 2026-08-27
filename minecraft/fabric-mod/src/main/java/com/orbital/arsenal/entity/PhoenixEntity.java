package com.orbital.arsenal.entity;

import net.minecraft.entity.EntityType;
import net.minecraft.entity.ai.goal.ActiveTargetGoal;
import net.minecraft.entity.ai.goal.LookAroundGoal;
import net.minecraft.entity.ai.goal.LookAtEntityGoal;
import net.minecraft.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.entity.ai.goal.WanderAroundFarGoal;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.world.World;

/** Fast, bright, and hard to keep up with. Fire does not trouble it. */
public class PhoenixEntity extends HostileEntity {
    public PhoenixEntity(EntityType<? extends HostileEntity> type, World world) {
        super(type, world);
    }

    public static DefaultAttributeContainer.Builder createPhoenixAttributes() {
        return HostileEntity.createHostileAttributes()
                .add(EntityAttributes.MAX_HEALTH, 160.0)
                // Quick where the golem and the kraken are slow, so the set of
                // mobs is not six ways of being large.
                .add(EntityAttributes.MOVEMENT_SPEED, 0.42)
                .add(EntityAttributes.ATTACK_DAMAGE, 9.0)
                .add(EntityAttributes.FOLLOW_RANGE, 48.0)
                .add(EntityAttributes.KNOCKBACK_RESISTANCE, 0.1);
    }

    @Override
    protected void initGoals() {
        this.goalSelector.add(1, new MeleeAttackGoal(this, 1.3, true));
        this.goalSelector.add(2, new WanderAroundFarGoal(this, 1.1));
        this.goalSelector.add(3, new LookAtEntityGoal(this, PlayerEntity.class, 44.0F));
        this.goalSelector.add(4, new LookAroundGoal(this));
        this.targetSelector.add(1, new ActiveTargetGoal<>(this, PlayerEntity.class, true));
    }
}
