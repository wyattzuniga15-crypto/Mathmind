package com.orbital.arsenal;

import com.orbital.arsenal.companion.Brain;
import com.orbital.arsenal.companion.Companion;
import com.orbital.arsenal.companion.CompanionCommand;
import com.orbital.arsenal.companion.CompanionConfig;
import com.orbital.arsenal.time.Journal;
import net.fabricmc.loader.api.FabricLoader;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class OrbitalArsenal implements ModInitializer {
    public static final String MOD_ID = "orbital";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        ModItems.register();
        Brain.configure(CompanionConfig.load(FabricLoader.getInstance().getConfigDir()));
        CompanionCommand.register();
        // Every weapon spreads its work across ticks rather than doing it all
        // in one, so nothing here ever stalls the server for a second.
        ServerTickEvents.END_SERVER_TICK.register(server -> {
            Scheduler.tick();
            Journal.tick();
            Companion.tickAll();
        });
        LOGGER.info("Orbital Arsenal ready");
    }
}
