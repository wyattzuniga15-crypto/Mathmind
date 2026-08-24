package net.minecraft.server.network;

public class ServerPlayNetworkHandler {
    // The three-argument form does not exist in 1.21.11 — yaw and pitch are
    // required. Declaring the short one here is what let a bad call through.
    public void requestTeleport(double x, double y, double z, float yaw, float pitch) {}
}
