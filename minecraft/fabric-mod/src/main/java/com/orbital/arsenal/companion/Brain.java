package com.orbital.arsenal.companion;

import com.orbital.arsenal.OrbitalArsenal;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

/**
 * The conversation itself.
 *
 * Runs entirely off the server thread. A request takes one to three seconds,
 * and the server thread is the game — blocking it would freeze the world for
 * every player until the reply came back. Tools hop back across in Task.
 *
 * Deliberately mentions no SDK type anywhere. Every one of those lives behind
 * ClaudeLink, so a bundled library that fails to resolve at runtime can only
 * break the conversation — never the mod that carries it.
 */
public final class Brain {
    /**
     * One thread, not a pool. Requests are rare, and serialising them keeps a
     * player who spams the command from opening a dozen sockets at once.
     */
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "orbital-companion");
        // Daemon: a request in flight must never keep a closing game open.
        thread.setDaemon(true);
        return thread;
    });

    /** Short rolling memory so it can follow a back-and-forth. */
    private static final int REMEMBERED_TURNS = 6;
    private static final Map<ServerPlayerEntity, Deque<String[]>> HISTORY = new HashMap<>();
    private static final Set<ServerPlayerEntity> BUSY = new HashSet<>();

    private static CompanionConfig config;

    private Brain() {}

    /** The live config, so a command can write a key into it. */
    public static CompanionConfig config() {
        return config;
    }

    public static void configure(CompanionConfig loaded) {
        config = loaded;
    }

    public static boolean ready() {
        return config != null && config.hasKey();
    }

    public static void forget(ServerPlayerEntity player) {
        HISTORY.remove(player);
        BUSY.remove(player);
    }

    /** Ask the companion something. Returns immediately; the reply arrives later. */
    public static void ask(ServerPlayerEntity player, MinecraftServer server, String message) {
        if (!ready()) {
            player.sendMessage(Text.literal(
                    "§cNo API key set. Put one in config/orbital-companion.json and restart."), false);
            return;
        }
        if (!BUSY.add(player)) {
            player.sendMessage(Text.literal("§7(still thinking about the last one)"), false);
            return;
        }
        // Latency is 1-3 seconds and silence reads as a broken command, so say
        // something immediately rather than leaving the player wondering.
        player.sendMessage(Text.literal("§8… thinking"), true);

        WORKER.submit(() -> {
            String reply;
            try {
                reply = converse(player, server, message);
            } catch (Throwable error) {
                // Throwable, not Exception: a bundled library that fails to
                // resolve raises NoClassDefFoundError, which is an Error. That
                // is precisely the failure this catch is here for.
                OrbitalArsenal.LOGGER.error("companion request failed", error);
                reply = "§c(the companion is unavailable — see the log)";
            } finally {
                Conversation.end();
            }
            String finished = reply;
            server.execute(() -> {
                BUSY.remove(player);
                player.sendMessage(Text.literal(finished), false);
            });
        });
    }

    private static String converse(ServerPlayerEntity player, MinecraftServer server, String message) {
        Conversation.begin(player, server);
        Deque<String[]> history = HISTORY.computeIfAbsent(player, key -> new ArrayDeque<>());

        // The only call into SDK-touching code, and the caller wraps it.
        String reply = ClaudeLink.ask(config, situation(player, server),
                new ArrayList<>(history), message);
        if (reply.isEmpty()) {
            reply = "(done)";
        }

        history.addLast(new String[] {message, reply});
        while (history.size() > REMEMBERED_TURNS) {
            history.removeFirst();
        }
        return "§b<companion> §f" + reply;
    }

    /**
     * What the companion knows about right now.
     *
     * Position and state go in every request because the model has no other
     * way to see the world — without them "come here" and "dig down" have no
     * meaning, and it invents coordinates instead of using real ones.
     */
    private static String situation(ServerPlayerEntity player, MinecraftServer server) {
        String[] facts = Task.onServer(server, () -> {
            Companion companion = Companion.of(player);
            return new String[] {
                player.getName().getString(),
                String.format("%.0f, %.0f, %.0f", player.getX(), player.getY(), player.getZ()),
                companion == null ? "not summoned" : companion.state(),
                companion == null ? "unknown"
                        : String.format("%.0f, %.0f, %.0f", companion.position().x,
                                companion.position().y, companion.position().z),
            };
        }, new String[] {"the player", "unknown", "unknown", "unknown"});

        return """
                You are a companion creature in a Minecraft world, bound to one player. \
                You speak in the game's chat, so keep replies to one or two short \
                sentences — long paragraphs scroll off the screen and are unreadable.

                You have tools for moving, building, digging, fighting, giving items \
                and firing the player's orbital weapons. Use them when the player asks \
                you to do something; just talk when they are only talking. Do not \
                narrate what you are about to do and then not do it — call the tool.

                You build by composing shapes: boxes, spheres, cylinders, beams, and \
                cleared space. Anything the player asks for is some arrangement of \
                those. A castle is walls, corner towers, a gatehouse and battlements; \
                a house is a hollow box, a roof of stepped boxes, and cleared holes for \
                the door and windows. Work it out as a handful of shapes and place them \
                by coordinate, building from the ground up.

                Two things to get right when building. Put it where the player means: \
                their position is below, so build near that unless they name somewhere \
                else, and start at their Y so it sits on the ground rather than buried \
                or floating. And build solid first, then clear the inside and the \
                openings — that is far fewer calls than trying to leave gaps.

                Builds rise over several seconds and the player is told when each one \
                finishes. Do not tell them it is done.

                The orbital weapons permanently destroy huge areas of the world. Fire \
                one only when the player names it and clearly means it.

                Right now:
                - The player is %s, standing at %s.
                - You are %s, at %s.
                """.formatted(facts[0], facts[1], facts[2], facts[3]);
    }
}
