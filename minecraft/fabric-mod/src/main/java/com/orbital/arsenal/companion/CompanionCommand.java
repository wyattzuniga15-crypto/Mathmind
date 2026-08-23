package com.orbital.arsenal.companion;

import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
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
            // body works without a key, the conversation does not.
            player.sendMessage(Text.literal(
                    "§eIt can follow you, but it can't talk yet — no API key in "
                            + "config/orbital-companion.json."), false);
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
