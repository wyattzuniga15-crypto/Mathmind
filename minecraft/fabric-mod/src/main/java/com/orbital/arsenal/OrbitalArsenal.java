package com.orbital.arsenal;

import com.orbital.arsenal.companion.CompanionSetup;
import com.orbital.arsenal.echo.Echoes;
import com.orbital.arsenal.time.Journal;
import com.orbital.arsenal.time.Souls;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class OrbitalArsenal implements ModInitializer {
    public static final String MOD_ID = "orbital";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        // Items first, and nothing that can throw before them. If this method
        // fails partway, Fabric refuses to load the mod at all — so anything
        // optional that runs earlier can take every weapon down with it.
        int registered = ModItems.register();
        LOGGER.info("Orbital Arsenal loaded — {} items registered", registered);

        ServerTickEvents.END_SERVER_TICK.register(server -> {
            // Every weapon spreads its work across ticks rather than doing it
            // all in one, so nothing here stalls the server for a second.
            Scheduler.tick();
            Journal.tick();
            Souls.tick(server);
            Echoes.tick(server);
            CompanionSetup.tick();
        });
        ServerLivingEntityEvents.AFTER_DEATH.register((entity, damage) -> Souls.died(entity));

        // The companion is optional and carries a bundled HTTP and JSON stack.
        // Throwable rather than Exception on purpose: a bundled library that
        // fails to resolve inside Minecraft\'s classloader raises
        // NoClassDefFoundError, which is an Error — and letting one escape from
        // here is what stops the whole mod loading.
        try {
            CompanionSetup.install();
        } catch (Throwable error) {
            LOGGER.error("the AI companion could not start — every other item still works", error);
        }
    }
}
