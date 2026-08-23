package com.orbital.arsenal.companion;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.beta.messages.MessageCreateParams;
import com.orbital.arsenal.OrbitalArsenal;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
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
    private static AnthropicClient client;

    private Brain() {}

    public static void configure(CompanionConfig loaded) {
        config = loaded;
        client = null;
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
            } catch (RuntimeException error) {
                OrbitalArsenal.LOGGER.error("companion request failed", error);
                reply = "§c(couldn't reach Claude — check the log and your API key)";
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
        if (client == null) {
            client = AnthropicOkHttpClient.builder().apiKey(config.apiKey()).build();
        }

        MessageCreateParams.Builder params = MessageCreateParams.builder()
                .model(config.model())
                .maxTokens((long) config.maxTokens())
                .putAdditionalHeader("anthropic-beta", "structured-outputs-2025-11-13")
                .system(situation(player, server))
                .addTool(Tools.FollowMe.class)
                .addTool(Tools.Stay.class)
                .addTool(Tools.ComeHere.class)
                .addTool(Tools.GoTo.class)
                .addTool(Tools.Mine.class)
                .addTool(Tools.AttackNearby.class)
                .addTool(Tools.GiveItem.class)
                .addTool(Tools.FireWeapon.class);

        Deque<String[]> history = HISTORY.computeIfAbsent(player, key -> new ArrayDeque<>());
        for (String[] turn : history) {
            params.addUserMessage(turn[0]);
            params.addAssistantMessage(turn[1]);
        }
        params.addUserMessage(message);

        StringBuilder spoken = new StringBuilder();
        // The runner drives the whole tool loop: it calls the API, runs any
        // tool the model picks, feeds the result back, and repeats until the
        // model has nothing left to do. Each message it yields is one turn.
        for (var turn : client.beta().messages().toolRunner(params.build())) {
            for (var block : turn.content()) {
                block.text().ifPresent(text -> {
                    if (!spoken.isEmpty()) {
                        spoken.append(' ');
                    }
                    spoken.append(text.text());
                });
            }
        }

        String reply = spoken.toString().trim();
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
                player.getGameProfile().getName(),
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

                You have tools for moving, digging, fighting, giving items and firing \
                the player's orbital weapons. Use them when the player asks you to do \
                something; just talk when they are only talking. Do not narrate what \
                you are about to do and then not do it — call the tool.

                The orbital weapons permanently destroy huge areas of the world. Fire \
                one only when the player names it and clearly means it.

                Right now:
                - The player is %s, standing at %s.
                - You are %s, at %s.
                """.formatted(facts[0], facts[1], facts[2], facts[3]);
    }
}
