package com.orbital.arsenal.companion;

import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

/**
 * /ai — the way you talk to the companion.
 *
 * A command rather than a chat prefix, so nothing you say to other players can
 * be swallowed by the companion by accident.
 */
public final class CompanionCommand {
    private static final String DEFAULT_NAME = "Companion";

    private CompanionCommand() {}

    public static void register() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registry, environment) ->
                dispatcher.register(CommandManager.literal("ai")
                        .then(CommandManager.literal("spawn")
                                .executes(context -> spawn(context.getSource())))
                        .then(CommandManager.literal("dismiss")
                                .executes(context -> dismiss(context.getSource())))
                        .then(CommandManager.literal("provider")
                                .executes(context -> whichProvider(context.getSource()))
                                .then(CommandManager.argument("name", StringArgumentType.word())
                                        .executes(context -> setProvider(
                                                context.getSource(),
                                                StringArgumentType.getString(context, "name")))))
                        .then(CommandManager.literal("key")
                                .executes(context -> whereIsTheKey(context.getSource()))
                                .then(CommandManager.argument("value", StringArgumentType.word())
                                        .executes(context -> setKey(
                                                context.getSource(),
                                                StringArgumentType.getString(context, "value")))))
                        .then(CommandManager.argument("message", StringArgumentType.greedyString())
                                .executes(context -> talk(
                                        context.getSource(),
                                        StringArgumentType.getString(context, "message"))))));
    }

    private static int spawn(ServerCommandSource source) {
        ServerPlayerEntity player = source.getPlayer();
        if (player == null) {
            return 0;
        }
        Companion companion = Companion.summon(player, DEFAULT_NAME);
        if (companion == null) {
            player.sendMessage(Text.literal("§cCouldn't summon a companion here."), false);
            return 0;
        }
        Brain.forget(player);
        player.sendMessage(Text.literal(
                "§b" + DEFAULT_NAME + " is here. §7Talk to it with /ai <message>."), false);
        if (!Brain.ready()) {
            // Worth saying now rather than on the first thing they type: the
            // body works without a key, the conversation does not. And say
            // what to do about it, including the thing that needs no key at
            // all — otherwise this reads as a dead end.
            player.sendMessage(Text.literal(
                    "§eIt can follow you and fight, but it can't talk yet — that needs "
                            + "an API key. §f/ai key§e to set one up."), false);
            player.sendMessage(Text.literal(
                    "§7No key needed for §f/build§7 — try §f/build castle§7. Or run one free "
                            + "on this computer: §f/ai provider ollama§7."), false);
        }
        return 1;
    }

    private static int dismiss(ServerCommandSource source) {
        ServerPlayerEntity player = source.getPlayer();
        if (player == null) {
            return 0;
        }
        Companion.dismiss(player);
        Brain.forget(player);
        player.sendMessage(Text.literal("§7Companion dismissed."), false);
        return 1;
    }

    /**
     * The presets.
     *
     * All four speak the same chat-completions shape, so the only thing that
     * actually differs between them is a URL and a model name — which is why
     * switching is a config write rather than a code path.
     */
    private static final java.util.Map<String, String[]> PROVIDERS = java.util.Map.of(
            "claude", new String[] {"", "", "Claude, through your API key"},
            "ollama", new String[] {"http://localhost:11434/v1", "gemma4:e4b",
                    "a model on this computer — free, no key, works offline"},
            "groq", new String[] {"https://api.groq.com/openai/v1", "llama-3.3-70b-versatile",
                    "Groq's free tier — needs a key from console.groq.com"},
            "openrouter", new String[] {"https://openrouter.ai/api/v1",
                    "meta-llama/llama-3.3-70b-instruct:free",
                    "OpenRouter — needs a key from openrouter.ai"});

    private static int whichProvider(ServerCommandSource source) {
        ServerPlayerEntity player = source.getPlayer();
        if (player == null) {
            return 0;
        }
        CompanionConfig config = Brain.config();
        player.sendMessage(Text.literal("§bNow using: §f"
                + (config == null ? "nothing" : config.provider())), false);
        for (java.util.Map.Entry<String, String[]> entry : PROVIDERS.entrySet()) {
            player.sendMessage(Text.literal(
                    "§f/ai provider " + entry.getKey() + " §7— " + entry.getValue()[2]), false);
        }
        return 1;
    }

    private static int setProvider(ServerCommandSource source, String name) {
        ServerPlayerEntity player = source.getPlayer();
        if (player == null) {
            return 0;
        }
        String want = name == null ? "" : name.trim().toLowerCase();
        String[] preset = PROVIDERS.get(want);
        if (preset == null) {
            player.sendMessage(Text.literal("§7No preset called §f" + want
                    + "§7. Try: §f" + String.join("§7, §f", PROVIDERS.keySet())), false);
            return 0;
        }
        CompanionConfig config = Brain.config();
        if (config == null) {
            player.sendMessage(Text.literal("§cThe companion never started."), false);
            return 0;
        }
        if (!config.saveProvider(FabricLoader.getInstance().getConfigDir(),
                want, preset[0], preset[1])) {
            player.sendMessage(Text.literal("§cCouldn't write the config file."), false);
            return 0;
        }
        player.sendMessage(Text.literal("§aNow using " + want + " — " + preset[2] + "."), false);
        if (want.equals("ollama")) {
            player.sendMessage(Text.literal(
                    "§7Make sure Ollama is running and you have the model: "
                            + "§follama pull " + preset[1]), false);
            player.sendMessage(Text.literal(
                    "§7A small local model is fine at §fbuild a tower here§7, and weak at "
                            + "long instructions. Change §flocalModel§7 in the config for a "
                            + "bigger one."), false);
        } else if (!want.equals("claude") && !config.hasKey()) {
            player.sendMessage(Text.literal(
                    "§eThat one still needs a key — §f/ai key <paste>§e."), false);
        }
        player.sendMessage(Text.literal("§7Try it: §f/ai hello"), false);
        return 1;
    }

    /** Say exactly where the key goes, and what it costs, and what is free. */
    private static int whereIsTheKey(ServerCommandSource source) {
        ServerPlayerEntity player = source.getPlayer();
        if (player == null) {
            return 0;
        }
        player.sendMessage(Text.literal("§b— Giving the companion a voice —"), false);
        player.sendMessage(Text.literal(
                "§71. Get a key at §fconsole.anthropic.com§7 (it costs money — about a "
                        + "fifth of a cent a message on the default model)."), false);
        player.sendMessage(Text.literal(
                "§72. Run §f/ai key <paste-it-here>§7, or put it in this file:"), false);
        player.sendMessage(Text.literal(
                "§8   " + CompanionConfig.file(
                        FabricLoader.getInstance().getConfigDir()).toAbsolutePath()), false);
        player.sendMessage(Text.literal(
                "§7Already have §fANTHROPIC_API_KEY§7 set? It is picked up on its own."), false);
        player.sendMessage(Text.literal(
                "§aNone of this is needed for §f/build§a — that works right now."), false);
        player.sendMessage(Text.literal(
                "§aNor for §f/ai provider ollama§a — free, and no key at all."), false);
        return 1;
    }

    private static int setKey(ServerCommandSource source, String key) {
        ServerPlayerEntity player = source.getPlayer();
        if (player == null) {
            return 0;
        }
        CompanionConfig config = Brain.config();
        if (config == null) {
            player.sendMessage(Text.literal("§cThe companion never started, so it has "
                    + "nowhere to keep a key."), false);
            return 0;
        }
        if (!config.saveKey(FabricLoader.getInstance().getConfigDir(), key)) {
            player.sendMessage(Text.literal("§cCouldn't write the config file."), false);
            return 0;
        }
        player.sendMessage(Text.literal("§aKey saved. The companion can talk now — "
                + "try §f/ai hello§a."), false);
        // Commands go into the game's log, so the key is now sitting in a file
        // people cheerfully paste into forum posts when asking for help. Say so
        // once, plainly, rather than leaving them to find out.
        player.sendMessage(Text.literal("§e⚠ That command is written to your logs folder. "
                + "If you ever share a log, replace the key at console.anthropic.com."), false);
        return 1;
    }

    private static int talk(ServerCommandSource source, String message) {
        ServerPlayerEntity player = source.getPlayer();
        if (player == null) {
            return 0;
        }
        if (Companion.of(player) == null) {
            player.sendMessage(Text.literal("§7No companion yet — summon one with §f/ai spawn§7."), false);
            return 0;
        }
        Brain.ask(player, source.getServer(), message);
        return 1;
    }
}
