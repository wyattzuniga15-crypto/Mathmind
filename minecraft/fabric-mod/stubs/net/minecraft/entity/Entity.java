package net.minecraft.entity;

import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

// Kept honest against Yarn 1.21.11. Two members that used to be here are
// deliberately absent, because the real class does not have them and a stub
// that lied about it let a build pass verification and then fail to compile:
//
//   getPos()          -> renamed; use getX()/getY()/getZ()
//   velocityModified  -> gone; use addVelocity(), which marks it itself
public class Entity {
    public HitResult raycast(double d, float t, boolean f) { return null; }
    public Vec3d getEyePos() { return null; }
    public double getX() { return 0.0; }
    public double getY() { return 0.0; }
    public double getZ() { return 0.0; }
    public Vec3d getVelocity() { return null; }
    public void setVelocity(Vec3d v) {}
    public void addVelocity(double x, double y, double z) {}
    public boolean isOnGround() { return false; }
    public Vec3d getRotationVec(float t) { return null; }
    public BlockPos getBlockPos() { return null; }
    public void setPosition(double x, double y, double z) {}
    public void setGlowing(boolean glowing) {}
    public void setInvisible(boolean invisible) {}
    public void setNoGravity(boolean noGravity) {}
    public void setInvulnerable(boolean invulnerable) {}
    public void discard() {}
    public java.util.UUID getUuid() { return null; }
    public void addCommandTag(String tag) {}
    public java.util.Set<String> getCommandTags() { return java.util.Set.of(); }
    public void setYaw(float yaw) {}
    public void setPitch(float pitch) {}
    public float getYaw() { return 0.0f; }
    public float getPitch() { return 0.0f; }
    public boolean isSneaking() { return false; }
    public boolean isRemoved() { return false; }
    public EntityType<?> getType() { return null; }
    public net.minecraft.text.Text getCustomName() { return null; }
    public void setCustomName(net.minecraft.text.Text name) {}
    public net.minecraft.world.World getEntityWorld() { return null; }
}
