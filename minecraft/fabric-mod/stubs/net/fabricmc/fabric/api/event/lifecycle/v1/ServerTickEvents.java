package net.fabricmc.fabric.api.event.lifecycle.v1;

public class ServerTickEvents {
    public interface EndTick { void onEndTick(Object server); }
    public static class Event { public void register(EndTick h) {} }
    public static final Event END_SERVER_TICK = new Event();
}
