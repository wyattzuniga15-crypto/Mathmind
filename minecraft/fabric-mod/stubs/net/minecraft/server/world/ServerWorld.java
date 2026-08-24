package net.minecraft.server.world;

import net.minecraft.block.BlockState;
import net.minecraft.entity.Entity;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvent;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;
public class ServerWorld extends World {
    public void playSound(Entity except, BlockPos pos, SoundEvent sound, SoundCategory cat, float vol, float pitch) {}
    public void spawnEntity(Entity e) {}
    public net.minecraft.server.MinecraftServer getServer() { return null; }
    public Iterable<Entity> iterateEntities() { return java.util.List.of(); }
    public void spawnParticles(ParticleEffect effect, double x, double y, double z, int count, double dx, double dy, double dz, double speed) {}
    public void spawnParticles(ParticleEffect effect, boolean force, boolean important, double x, double y, double z, int count, double dx, double dy, double dz, double speed) {}
    public void createExplosion(Entity source, double x, double y, double z, float power, ExplosionSourceType type) {}
    public BlockState getBlockState(BlockPos pos) { return null; }
    public void setBlockState(BlockPos pos, BlockState state, int flags) {}
    public java.util.List<Entity> getOtherEntities(Entity except, net.minecraft.util.math.Box box) {
        return java.util.List.of();
    }
}
