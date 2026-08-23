package com.orbital.arsenal.companion;

import com.orbital.arsenal.OrbitalArsenal;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;
import net.minecraft.server.MinecraftServer;

/**
 * The bridge between the two threads this feature lives on.
 *
 * The API call must not run on the server thread — it takes one to three
 * seconds, and the server thread is the game: blocking it freezes the world
 * for every player until the reply arrives. So the conversation runs on a
 * background thread.
 *
 * But the opposite is just as true. Touching the world off the server thread
 * corrupts it — chunk state and entity lists have no locking and assume a
 * single writer. So every action hops back and waits for the result here.
 */
final class Task {
    /**
     * Long enough for a busy tick, short enough that a stopping server frees
     * the waiting thread instead of hanging on shutdown.
     */
    private static final long TIMEOUT_SECONDS = 10;

    private Task() {}

    /** Run this on the server thread and wait for what it returns. */
    static <T> T onServer(MinecraftServer server, Supplier<T> work, T fallback) {
        CompletableFuture<T> result = new CompletableFuture<>();
        server.execute(() -> {
            try {
                result.complete(work.get());
            } catch (RuntimeException error) {
                result.completeExceptionally(error);
            }
        });
        try {
            return result.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return fallback;
        } catch (TimeoutException timeout) {
            OrbitalArsenal.LOGGER.warn("companion action timed out waiting for the server thread");
            return fallback;
        } catch (Exception error) {
            OrbitalArsenal.LOGGER.error("companion action failed", error);
            return fallback;
        }
    }
}
