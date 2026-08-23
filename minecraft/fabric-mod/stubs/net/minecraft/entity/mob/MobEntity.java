package net.minecraft.entity.mob;

import net.minecraft.entity.Entity;
import net.minecraft.text.Text;

public class MobEntity extends Entity {
    public void setCustomName(Text name) {}
    public void setCustomNameVisible(boolean visible) {}
    public void setInvulnerable(boolean invulnerable) {}
    public void setNoGravity(boolean noGravity) {}
    public void setPosition(double x, double y, double z) {}
    public void discard() {}
    public boolean isRemoved() { return false; }
}
