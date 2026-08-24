package com.orbital.arsenal.companion;

import com.orbital.arsenal.OrbitalArsenal;
import net.fabricmc.loader.api.FabricLoader;

/**
 * The companion's one entry point, and a firebreak around it.
 *
 * Everything the companion needs is reached through here so the mod's
 * initializer can wrap it in a single catch. Without that, an optional chat
 * feature failing to start takes eleven weapons down with it — which is exactly
 * what happened.
 *
 * The tick hook checks a flag rather than being registered conditionally,
 * because the tick loop is set up before this runs and must not depend on
 * whether it succeeded.
 */
public final class CompanionSetup {
    private static boolean installed = false;

    private CompanionSetup() {}

    public static void install() {
        Brain.configure(CompanionConfig.load(FabricLoader.getInstance().getConfigDir()));
        CompanionCommand.register();
        installed = true;
        OrbitalArsenal.LOGGER.info("AI companion ready — /ai spawn");
    }

    public static void tick() {
        if (installed) {
            Companion.tickAll();
        }
    }
}
