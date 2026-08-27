package com.orbital.arsenal;

import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;

/**
 * /build &lt;thing&gt; — the no-account way in.
 *
 * The companion can build anything you describe, but it needs an API key, and
 * a mod that does nothing until you have signed up for something is a mod most
 * people never see working. This runs the same shape engine off prepared
 * arrangements instead of a model's, so it works the moment the jar is in.
 */
public final class BuildCommand {
    private BuildCommand() {}

    public static void register() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registry, environment) ->
                dispatcher.register(CommandManager.literal("build")
                        .executes(context -> list(context.getSource()))
                        .then(CommandManager.argument("what", StringArgumentType.word())
                                .executes(context -> raise(
                                        context.getSource(),
                                        StringArgumentType.getString(context, "what"))))));
    }

    private static int list(ServerCommandSource source) {
        ServerPlayerEntity player = source.getPlayer();
        if (player == null) {
            return 0;
        }
        player.sendMessage(Text.literal(
                "§bBuild what? §f" + String.join("§7, §f", Blueprints.NAMES)), false);
        player.sendMessage(Text.literal(
                "§7It goes up where you stand. Rewind clocks undo it."), false);
        return 1;
    }

    private static int raise(ServerCommandSource source, String what) {
        ServerPlayerEntity player = source.getPlayer();
        if (player == null) {
            return 0;
        }
        // From the command source, not the entity: Entity.getWorld() has been
        // renamed across versions and this has not.
        ServerWorld world = source.getWorld();
        if (!Blueprints.raise(world, player, what)) {
            player.sendMessage(Text.literal(
                    "§7There's no blueprint called §f" + what + "§7. Try: §f"
                            + String.join("§7, §f", Blueprints.NAMES)), false);
            return 0;
        }
        player.sendMessage(Text.literal("§b⛏ Building your " + what.toLowerCase()
                + "… §7it rises over a few seconds."), true);
        return 1;
    }
}
