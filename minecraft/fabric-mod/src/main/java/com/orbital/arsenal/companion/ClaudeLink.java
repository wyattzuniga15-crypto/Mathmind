package com.orbital.arsenal.companion;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.beta.messages.MessageCreateParams;
import java.util.List;

/**
 * The only class in this mod that touches the Anthropic SDK.
 *
 * That isolation is the whole reason it exists, and it was learned the hard
 * way. The SDK ships bundled inside the mod jar, and a bundled library that
 * fails to resolve inside Minecraft's classloader throws NoClassDefFoundError
 * the instant anything *mentions* one of its types — loading a class resolves
 * its field types, so merely holding an AnthropicClient field is enough.
 *
 * When that happened from the mod's initializer, the mod failed to load
 * entirely and every weapon vanished with it: an optional chat feature taking
 * down eleven items that have nothing to do with it. Now every reference lives
 * behind this one class, reached only from inside a catch, and only when a
 * player actually types /ai.
 */
final class ClaudeLink {
    private static AnthropicClient client;

    private ClaudeLink() {}

    /** Ask Claude, running the whole tool loop. Throws if the SDK is unusable. */
    static String ask(CompanionConfig config, String system, List<String[]> history, String message) {
        if (client == null) {
            client = AnthropicOkHttpClient.builder().apiKey(config.apiKey()).build();
        }

        MessageCreateParams.Builder params = MessageCreateParams.builder()
                .model(config.model())
                .maxTokens((long) config.maxTokens())
                .putAdditionalHeader("anthropic-beta", "structured-outputs-2025-11-13")
                .system(system)
                .addTool(Tools.FollowMe.class)
                .addTool(Tools.Stay.class)
                .addTool(Tools.ComeHere.class)
                .addTool(Tools.GoTo.class)
                .addTool(Tools.Mine.class)
                .addTool(Tools.AttackNearby.class)
                .addTool(Tools.GiveItem.class)
                .addTool(Tools.FireWeapon.class);

        for (String[] turn : history) {
            params.addUserMessage(turn[0]);
            params.addAssistantMessage(turn[1]);
        }
        params.addUserMessage(message);

        StringBuilder spoken = new StringBuilder();
        // The runner drives the whole loop: it calls the API, runs whichever
        // tool the model picks, feeds the result back, and repeats until the
        // model is done. Each message it yields is one turn.
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
        return spoken.toString().trim();
    }

    /** Drop the cached client so a changed config is picked up next time. */
    static void reset() {
        client = null;
    }
}
