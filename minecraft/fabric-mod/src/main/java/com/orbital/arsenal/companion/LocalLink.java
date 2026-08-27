package com.orbital.arsenal.companion;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/**
 * The companion, talking to something that is not Claude.
 *
 * Ollama, Groq, OpenRouter and Gemini all expose the same chat-completions
 * shape, so this one class reaches every one of them — the provider is a base
 * URL and a model name, not a code path. Ollama in particular runs on the
 * player's own machine, needs no key and no account, and works with the
 * internet off.
 *
 * Written against plain HTTP and Gson on purpose. Both are already inside
 * Minecraft, so this path carries no bundled library at all and cannot be
 * broken by one failing to resolve — which is exactly how the mod once failed
 * to load. It also names no Anthropic type, so it keeps working when the SDK
 * is absent entirely.
 */
public final class LocalLink {
    /**
     * A local model on a middling machine can take half a minute to answer,
     * and a tool loop takes several of those. The default HTTP timeout would
     * report failure while the model was still working.
     */
    private static final Duration TIMEOUT = Duration.ofSeconds(180);

    /**
     * A cap on tool rounds. A capable model finishes in two or three; a small
     * one can call the same tool forever, and without a ceiling that is an
     * endless spend of the player's own CPU.
     */
    private static final int MAX_ROUNDS = 10;

    private static final Gson GSON = new Gson();
    private static HttpClient client;

    private LocalLink() {}

    /** Ask whatever is at the configured base URL, running the whole tool loop. */
    static String ask(CompanionConfig config, String system, List<String[]> history, String message) {
        if (client == null) {
            client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        }

        JsonArray messages = new JsonArray();
        messages.add(role("system", system));
        for (String[] turn : history) {
            messages.add(role("user", turn[0]));
            messages.add(role("assistant", turn[1]));
        }
        messages.add(role("user", message));

        StringBuilder spoken = new StringBuilder();
        for (int round = 0; round < MAX_ROUNDS; round++) {
            JsonObject reply = send(config, messages);
            if (reply == null) {
                return spoken.isEmpty()
                        ? "(no answer — is Ollama running? try: ollama serve)"
                        : spoken.toString().trim();
            }

            JsonElement content = reply.get("content");
            if (content != null && !content.isJsonNull() && !content.getAsString().isBlank()) {
                spoken.append(content.getAsString().trim()).append(' ');
            }

            JsonElement calls = reply.get("tool_calls");
            if (calls == null || calls.isJsonNull() || calls.getAsJsonArray().isEmpty()) {
                return spoken.toString().trim();
            }

            // The assistant turn has to go back verbatim, tool calls and all,
            // or the results below have nothing to attach to.
            messages.add(reply);
            for (JsonElement element : calls.getAsJsonArray()) {
                JsonObject call = element.getAsJsonObject();
                JsonObject function = call.getAsJsonObject("function");
                String name = function.get("name").getAsString();
                String result = Schemas.run(name, arguments(function));

                JsonObject answer = new JsonObject();
                answer.addProperty("role", "tool");
                if (call.has("id")) {
                    answer.addProperty("tool_call_id", call.get("id").getAsString());
                }
                answer.addProperty("name", name);
                answer.addProperty("content", result);
                messages.add(answer);
            }
        }
        return spoken.isEmpty()
                ? "(it kept calling tools and never finished — try asking for less at once)"
                : spoken.toString().trim();
    }

    /**
     * Arguments arrive as a JSON string from most providers and as an object
     * from Ollama. Accept both rather than betting on one.
     */
    private static JsonObject arguments(JsonObject function) {
        JsonElement raw = function.get("arguments");
        if (raw == null || raw.isJsonNull()) {
            return new JsonObject();
        }
        try {
            if (raw.isJsonObject()) {
                return raw.getAsJsonObject();
            }
            JsonElement parsed = JsonParser.parseString(raw.getAsString());
            return parsed.isJsonObject() ? parsed.getAsJsonObject() : new JsonObject();
        } catch (RuntimeException malformed) {
            return new JsonObject();
        }
    }

    /** One request. Returns the assistant message, or null if it went wrong. */
    private static JsonObject send(CompanionConfig config, JsonArray messages) {
        JsonObject body = new JsonObject();
        body.addProperty("model", config.localModel());
        body.add("messages", messages);
        body.add("tools", Schemas.toolsJson());
        body.addProperty("stream", false);

        try {
            HttpRequest.Builder request = HttpRequest.newBuilder()
                    .uri(URI.create(config.baseUrl().replaceAll("/+$", "") + "/chat/completions"))
                    .timeout(TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body)));
            // Ollama needs no key; the hosted free tiers do. Sending an empty
            // header to Ollama would be harmless but pointless.
            if (config.hasKey()) {
                request.header("Authorization", "Bearer " + config.apiKey());
            }

            HttpResponse<String> response =
                    client.send(request.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                // The body carries the actual reason — a missing model, most
                // often — and swallowing it leaves the player with a number.
                return null;
            }
            JsonObject parsed = JsonParser.parseString(response.body()).getAsJsonObject();
            JsonArray choices = parsed.getAsJsonArray("choices");
            if (choices == null || choices.isEmpty()) {
                return null;
            }
            return choices.get(0).getAsJsonObject().getAsJsonObject("message");
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception error) {
            return null;
        }
    }

    private static JsonObject role(String role, String content) {
        JsonObject message = new JsonObject();
        message.addProperty("role", role);
        message.addProperty("content", content);
        return message;
    }
}
