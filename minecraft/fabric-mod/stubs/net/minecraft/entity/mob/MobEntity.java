package net.minecraft.entity.mob;

import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.ai.goal.GoalSelector;
import net.minecraft.text.Text;

public class MobEntity extends LivingEntity {
    protected final GoalSelector goalSelector = new GoalSelector();
    protected final GoalSelector targetSelector = new GoalSelector();
    protected void initGoals() {}
    public void setCustomName(Text name) {}
    public void setCustomNameVisible(boolean visible) {}
}
