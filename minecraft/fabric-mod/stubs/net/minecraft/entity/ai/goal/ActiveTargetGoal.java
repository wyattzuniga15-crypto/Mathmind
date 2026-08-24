package net.minecraft.entity.ai.goal;

import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.mob.MobEntity;

public class ActiveTargetGoal<T extends LivingEntity> extends Goal {
    public ActiveTargetGoal(MobEntity mob, Class<T> target, boolean checkVisibility) {}
}
