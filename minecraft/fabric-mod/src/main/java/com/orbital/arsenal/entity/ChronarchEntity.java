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

/**
 * The Chronarch itself — a mob of its own, not a disguised anything.
 *
 * Its own registered entity type, its own attributes, its own goals and its
 * own model. What it does not have is a hand-tuned brain: a boss whose
 * interest is its three time phases does not also need bespoke pathfinding,
 * so the goals here are the ordinary hostile set. The fight lives in
 * boss/Chronarch, which drives the phases on top of this body.
 */
public class ChronarchEntity extends HostileEntity {
    public ChronarchEntity(EntityType<? extends HostileEntity> type, World world) {
        super(type, world);
    }

    /**
     * Deliberately tanky and slow rather than fast and fragile. The fight is
     * about outpacing its rewind, and a boss that can be kited forever would
     * make that a question of patience instead.
     */
    public static DefaultAttributeContainer.Builder createChronarchAttributes() {
        return HostileEntity.createHostileAttributes()
                .add(EntityAttributes.MAX_HEALTH, 400.0)
                .add(EntityAttributes.MOVEMENT_SPEED, 0.26)
                .add(EntityAttributes.ATTACK_DAMAGE, 12.0)
                .add(EntityAttributes.FOLLOW_RANGE, 48.0)
                // Immovable: being knocked about by every hit would make a
                // creature this size read as weightless.
                .add(EntityAttributes.KNOCKBACK_RESISTANCE, 1.0);
    }

    @Override
    protected void initGoals() {
        this.goalSelector.add(1, new MeleeAttackGoal(this, 1.0, true));
        this.goalSelector.add(2, new WanderAroundFarGoal(this, 0.8));
        this.goalSelector.add(3, new LookAtEntityGoal(this, PlayerEntity.class, 32.0F));
        this.goalSelector.add(4, new LookAroundGoal(this));
        this.targetSelector.add(1, new ActiveTargetGoal<>(this, PlayerEntity.class, true));
    }
}
