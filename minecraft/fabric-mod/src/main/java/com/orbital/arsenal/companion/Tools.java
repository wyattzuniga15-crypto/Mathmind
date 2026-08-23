package com.orbital.arsenal.companion;

import com.fasterxml.jackson.annotation.JsonClassDescription;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import java.util.function.Supplier;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;

/**
 * What the companion can actually do.
 *
 * Every one of these is a tool the model may choose to call, so the class and
 * field descriptions are not documentation for us — they are the only thing
 * the model reads when deciding whether a tool fits what you asked for. Vague
 * wording here shows up as a companion that picks the wrong action.
 *
 * Each returns a sentence describing what happened, which goes back to the
 * model as the tool result and lets it tell you in its own words.
 */
public final class Tools {
    private Tools() {}

    /** Every tool bounces to the server thread through here. */
    private static String act(java.util.function.Function<Companion, String> work) {
        Conversation conversation = Conversation.current();
        if (conversation == null) {
            return "No player context — cannot act.";
        }
        return Task.onServer(conversation.server, () -> {
            Companion companion = Companion.of(conversation.player);
            if (companion == null) {
                return "The companion is not summoned right now.";
            }
            return work.apply(companion);
        }, "That action could not be completed in time.");
    }

    @JsonClassDescription(
            "Start following the player around, staying a few blocks behind them. "
                    + "Use when the player asks you to come with them or follow.")
    public static class FollowMe implements Supplier<String> {
        @Override
        public String get() {
            return act(companion -> {
                companion.follow();
                return "Now following the player.";
            });
        }
    }

    @JsonClassDescription(
            "Stop moving and hold the current position. Use when the player asks you "
                    + "to wait, stay, or stop following.")
    public static class Stay implements Supplier<String> {
        @Override
        public String get() {
            return act(companion -> {
                companion.stay();
                return "Holding position.";
            });
        }
    }

    @JsonClassDescription(
            "Fly directly to the player's current position, then stop there. "
                    + "Use when the player asks you to come here or come back.")
    public static class ComeHere implements Supplier<String> {
        @Override
        public String get() {
            return act(companion -> {
                var owner = companion.owner();
                companion.goTo(new Vec3d(owner.getX(), owner.getY() + 1.5, owner.getZ()));
                return "On my way to the player.";
            });
        }
    }

    @JsonClassDescription(
            "Travel to specific world coordinates. Use when the player names a place "
                    + "to go by its X and Z coordinates.")
    public static class GoTo implements Supplier<String> {
        @JsonPropertyDescription("The X coordinate to travel to.")
        public double x;

        @JsonPropertyDescription("The Z coordinate to travel to.")
        public double z;

        @JsonPropertyDescription("The Y (height) coordinate. Use 80 if the player did not say.")
        public double y = 80.0;

        @Override
        public String get() {
            return act(companion -> {
                companion.goTo(new Vec3d(x, y, z));
                return String.format("Travelling to %.0f, %.0f, %.0f.", x, y, z);
            });
        }
    }

    @JsonClassDescription(
            "Clear out a rectangular area of blocks centred on where you are, digging "
                    + "downward. Use for requests like 'dig me a room', 'clear this out', "
                    + "or 'make me a hole'. Bedrock is never removed.")
    public static class Mine implements Supplier<String> {
        @JsonPropertyDescription(
                "How far out from the centre to clear, in blocks. 4 is a small room, "
                        + "10 is a large hall. Maximum 32.")
        public int radius = 4;

        @JsonPropertyDescription("How many blocks deep to dig. 4 is a room's height. Maximum 64.")
        public int depth = 4;

        @Override
        public String get() {
            int r = Math.max(1, Math.min(32, radius));
            int d = Math.max(1, Math.min(64, depth));
            return act(companion -> {
                ServerWorld world = companion.world();
                Vec3d at = companion.position();
                int cx = (int) Math.floor(at.x);
                int cy = (int) Math.floor(at.y);
                int cz = (int) Math.floor(at.z);
                BlockPos.Mutable pos = new BlockPos.Mutable();
                BlockState air = Blocks.AIR.getDefaultState();
                int cleared = 0;
                for (int y = cy; y > cy - d; y--) {
                    for (int x = -r; x <= r; x++) {
                        for (int z = -r; z <= r; z++) {
                            pos.set(cx + x, y, cz + z);
                            BlockState state = world.getBlockState(pos);
                            if (!state.isAir() && !state.isOf(Blocks.BEDROCK)) {
                                world.setBlockState(pos, air, 2);
                                cleared++;
                            }
                        }
                    }
                }
                return "Cleared " + cleared + " blocks.";
            });
        }
    }

    @JsonClassDescription(
            "Kill hostile mobs near you — zombies, skeletons, creepers and the like. "
                    + "Peaceful animals and players are never harmed. Use when the player "
                    + "asks you to fight, defend them, or clear out monsters.")
    public static class AttackNearby implements Supplier<String> {
        @JsonPropertyDescription("How far around you to sweep, in blocks. 16 is typical. Maximum 64.")
        public int radius = 16;

        @Override
        public String get() {
            double r = Math.max(1, Math.min(64, radius));
            return act(companion -> {
                ServerWorld world = companion.world();
                Vec3d at = companion.position();
                Box area = new Box(at.x - r, at.y - r, at.z - r, at.x + r, at.y + r, at.z + r);
                int killed = 0;
                for (Entity entity : world.getOtherEntities(companion.body(), area)) {
                    // Hostiles only, deliberately. A companion that could be
                    // talked into killing the player's animals — or the player
                    // — is a companion nobody wants to keep around.
                    if (entity instanceof HostileEntity hostile) {
                        hostile.kill(world);
                        killed++;
                    }
                }
                return killed == 0 ? "No hostile mobs nearby." : "Killed " + killed + " hostile mobs.";
            });
        }
    }

    @JsonClassDescription(
            "Give an item to the player. Use when the player asks you for something.")
    public static class GiveItem implements Supplier<String> {
        @JsonPropertyDescription(
                "The Minecraft item id, such as 'diamond', 'oak_planks' or 'cooked_beef'. "
                        + "No namespace prefix needed.")
        public String item = "";

        @JsonPropertyDescription("How many to give. Maximum 64.")
        public int count = 1;

        @Override
        public String get() {
            String id = item == null ? "" : item.trim().toLowerCase().replace("minecraft:", "");
            int amount = Math.max(1, Math.min(64, count));
            if (id.isEmpty()) {
                return "No item was named.";
            }
            return act(companion -> {
                Identifier identifier = Identifier.tryParse("minecraft:" + id);
                if (identifier == null) {
                    return "'" + id + "' is not a valid item id.";
                }
                Item found = Registries.ITEM.get(identifier);
                ItemStack stack = new ItemStack(found, amount);
                if (stack.isEmpty()) {
                    return "There is no item called '" + id + "'.";
                }
                companion.owner().giveItemStack(stack);
                return "Gave the player " + amount + " " + id + ".";
            });
        }
    }

    @JsonClassDescription(
            "Fire one of the player's orbital weapons at whatever the player is currently "
                    + "looking at. These are enormously destructive and permanently change "
                    + "the terrain. Only use this when the player clearly and specifically "
                    + "asks for that weapon to be fired.")
    public static class FireWeapon implements Supplier<String> {
        @JsonPropertyDescription(
                "Which weapon: 'strike_cannon' (5000 TNT), 'tactical_nuke' (a 200-block "
                        + "crater), 'kamehameha' (a bored tunnel), 'black_hole' (eats a "
                        + "350-block sphere), or 'orbital_laser' (a column to bedrock).")
        public String weapon = "";

        @Override
        public String get() {
            String name = weapon == null ? "" : weapon.trim().toLowerCase();
            return act(companion -> {
                String fired = Weapons.fire(name, companion.owner());
                if (fired == null) {
                    return "There is no weapon called '" + name + "'.";
                }
                return "Fired the " + fired + " at what the player is looking at.";
            });
        }
    }
}
