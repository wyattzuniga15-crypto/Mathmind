package com.orbital.arsenal.companion;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.orbital.arsenal.OrbitalArsenal;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * The companion's settings, read from config/orbital-companion.json.
 *
 * The API key lives here rather than in the jar or a command for the obvious
 * reason — a key in either would be shared with anyone the file is handed to.
 * Nothing in this class ever logs the key itself, only whether one is present.
 */
public final class CompanionConfig {
    private static final String FILE = "orbital-companion.json";

    /**
     * Haiku by default: a companion is asked a lot of small questions, and at
     * roughly a fifth of a cent a message it can be left running. The config
     * exists so this is the owner's call rather than mine — swapping in
     * claude-opus-5 buys a noticeably sharper companion for about a cent a
     * message.
     */
    private static final String DEFAULT_MODEL = "claude-haiku-4-5";

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private String apiKey = "";
    private String model = DEFAULT_MODEL;
    private int maxTokens = 1024;

    private CompanionConfig() {}

    public String model() {
        return model == null || model.isBlank() ? DEFAULT_MODEL : model;
    }

    public int maxTokens() {
        return maxTokens > 0 ? maxTokens : 1024;
    }

    public String apiKey() {
        return apiKey == null ? "" : apiKey.trim();
    }

    public boolean hasKey() {
        String key = apiKey();
        // A freshly written config carries the placeholder rather than a key,
        // and treating that as real would send a doomed request and report a
        // confusing 401 instead of "you haven't set your key yet".
        return !key.isEmpty() && !key.startsWith("paste-");
    }

    /**
     * Read the config, writing a commented default first if none exists.
     *
     * Never throws: a companion that cannot read its settings should say so in
     * chat, not take the world down with it.
     */
    public static CompanionConfig load(Path configDir) {
        CompanionConfig config = new CompanionConfig();
        Path file = configDir.resolve(FILE);
        try {
            if (!Files.exists(file)) {
                writeDefault(file);
                OrbitalArsenal.LOGGER.info("wrote a starter companion config to {}", file);
                return config;
            }
            JsonObject json = GSON.fromJson(Files.readString(file), JsonObject.class);
            if (json == null) {
                return config;
            }
            if (json.has("apiKey")) {
                config.apiKey = json.get("apiKey").getAsString();
            }
            if (json.has("model")) {
                config.model = json.get("model").getAsString();
            }
            if (json.has("maxTokens")) {
                config.maxTokens = json.get("maxTokens").getAsInt();
            }
        } catch (IOException | RuntimeException error) {
            // getAsString on a number, a truncated file, a bad path — all end
            // up here, and all mean the same thing to a player: no companion.
            OrbitalArsenal.LOGGER.error("could not read {} — the companion will stay quiet", file, error);
        }
        return config;
    }

    private static void writeDefault(Path file) throws IOException {
        JsonObject json = new JsonObject();
        json.addProperty("_comment",
                "Get a key from console.anthropic.com and paste it below. "
                        + "Keep this file private — anyone holding this key can spend on your account.");
        json.addProperty("apiKey", "paste-your-anthropic-api-key-here");
        json.addProperty("model", DEFAULT_MODEL);
        json.addProperty("_model_note",
                "claude-haiku-4-5 is cheap and quick. claude-opus-5 is sharper and costs more.");
        json.addProperty("maxTokens", 1024);
        Files.createDirectories(file.getParent());
        Files.writeString(file, GSON.toJson(json) + "\n");
    }
}
