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

    // ---- building ---------------------------------------------------------
    //
    // Five shapes, deliberately. The model composes them — a keep is walls,
    // four corner towers, a gatehouse and battlements, which is roughly
    // twenty-five calls rather than the fifty thousand a block-by-block tool
    // would demand. Descriptions here are written for the model, since they
    // are all it has to go on when choosing between them.

    /** Shared tail: run a shape and report it, or say why it was refused. */
    private static String raise(String what, String blockName, int x0, int y0, int z0,
                                int x1, int y1, int z1,
                                java.util.function.Supplier<Builder.Shape> shape) {
        BlockState state = Builder.block(blockName);
        if (state == null) {
            return "There is no block called '" + blockName + "'.";
        }
        return act(companion -> {
            long volume = Builder.fill(companion.world(), companion.owner(), what, state,
                    x0, y0, z0, x1, y1, z1, shape.get());
            if (volume < 0) {
                return "That is too big to build in one go — the limit is "
                        + Builder.MAX_VOLUME + " blocks of bounding volume. "
                        + "Build it in pieces.";
            }
            return "Building " + what + " out of " + blockName
                    + ". It will rise over the next few seconds; the player is told when it "
                    + "is finished, so do not claim it is done yet.";
        });
    }

    @JsonClassDescription(
            "Build a rectangular box of blocks between two corners — the workhorse for "
                    + "walls, floors, roofs, platforms, rooms and pillars. Set hollow for a "
                    + "room or a shell with its six faces only. Use repeat to stack copies, "
                    + "which is how to make floors of a tower or the teeth of battlements in "
                    + "one call instead of many.")
    public static class BuildBox implements Supplier<String> {
        @JsonPropertyDescription(
                "Block id, such as 'stone_bricks', 'oak_planks', 'glass' or 'air'. "
                        + "No namespace prefix needed.")
        public String block = "stone_bricks";

        @JsonPropertyDescription("One corner: X.") public int x1 = 0;
        @JsonPropertyDescription("One corner: Y.") public int y1 = 0;
        @JsonPropertyDescription("One corner: Z.") public int z1 = 0;
        @JsonPropertyDescription("Opposite corner: X.") public int x2 = 0;
        @JsonPropertyDescription("Opposite corner: Y.") public int y2 = 0;
        @JsonPropertyDescription("Opposite corner: Z.") public int z2 = 0;

        @JsonPropertyDescription(
                "True for just the six outer faces (a room, a shell). False for solid.")
        public boolean hollow = false;

        @JsonPropertyDescription(
                "How many copies in total, each shifted by the step values. 1 means a "
                        + "single box. Maximum 64.")
        public int repeat = 1;

        @JsonPropertyDescription("Shift between copies along X.") public int step_x = 0;
        @JsonPropertyDescription("Shift between copies along Y.") public int step_y = 0;
        @JsonPropertyDescription("Shift between copies along Z.") public int step_z = 0;

        @Override
        public String get() {
            int copies = Math.max(1, Math.min(64, repeat));
            if (copies > 1 && step_x == 0 && step_y == 0 && step_z == 0) {
                // Every copy would land on the last. Say so rather than
                // silently building one box and reporting many.
                return "repeat is more than 1 but every step is 0, so the copies would all "
                        + "sit in the same place. Set step_x, step_y or step_z.";
            }
            String last = "";
            for (int i = 0; i < copies; i++) {
                int ox = step_x * i, oy = step_y * i, oz = step_z * i;
                int ax = x1 + ox, ay = y1 + oy, az = z1 + oz;
                int bx = x2 + ox, by = y2 + oy, bz = z2 + oz;
                String what = copies == 1 ? "box" : "box " + (i + 1) + " of " + copies;
                last = raise(what, block, ax, ay, az, bx, by, bz,
                        () -> Builder.box(ax, ay, az, bx, by, bz, hollow));
                if (last.startsWith("There is no block") || last.startsWith("That is too big")) {
                    return last;
                }
            }
            return copies == 1 ? last : "Building " + copies + " boxes out of " + block + ".";
        }
    }

    @JsonClassDescription(
            "Build a sphere or a dome. Use for domes over an area, round roofs, planets, "
                    + "and bubbles. Set dome true to build only the top half, which is what "
                    + "a dome over the ground means.")
    public static class BuildSphere implements Supplier<String> {
        @JsonPropertyDescription("Block id, such as 'glass' or 'quartz_block'.")
        public String block = "glass";

        @JsonPropertyDescription("Centre X.") public int x = 0;
        @JsonPropertyDescription("Centre Y. For a dome this is the height it springs from.")
        public int y = 0;
        @JsonPropertyDescription("Centre Z.") public int z = 0;

        @JsonPropertyDescription("Radius in blocks. Maximum 100.")
        public int radius = 8;

        @JsonPropertyDescription("True for a shell one block thick, false for solid.")
        public boolean hollow = true;

        @JsonPropertyDescription("True to build only the upper half — a dome rather than a ball.")
        public boolean dome = false;

        @Override
        public String get() {
            int r = Math.max(1, Math.min(100, radius));
            int lowY = dome ? y : y - r;
            return raise(dome ? "dome" : "sphere", block,
                    x - r, lowY, z - r, x + r, y + r, z + r,
                    () -> Builder.sphere(x, y, z, r + 0.5, hollow, dome));
        }
    }

    @JsonClassDescription(
            "Build a vertical cylinder — round in plan, straight up. Use for towers, "
                    + "chimneys, wells, columns and silos. Hollow gives a tube you can "
                    + "stand inside; solid gives a pillar.")
    public static class BuildCylinder implements Supplier<String> {
        @JsonPropertyDescription("Block id, such as 'stone_bricks'.")
        public String block = "stone_bricks";

        @JsonPropertyDescription("Centre X.") public int x = 0;
        @JsonPropertyDescription("Y of the base — it is built upward from here.")
        public int y = 0;
        @JsonPropertyDescription("Centre Z.") public int z = 0;

        @JsonPropertyDescription("Radius in blocks. Maximum 100.") public int radius = 5;
        @JsonPropertyDescription("Height in blocks. Maximum 256.") public int height = 10;

        @JsonPropertyDescription("True for a tube with open ends, false for a solid pillar.")
        public boolean hollow = true;

        @Override
        public String get() {
            int r = Math.max(1, Math.min(100, radius));
            int h = Math.max(1, Math.min(256, height));
            return raise("cylinder", block, x - r, y, z - r, x + r, y + h - 1, z + r,
                    () -> Builder.cylinder(x, z, r + 0.5, hollow));
        }
    }

    @JsonClassDescription(
            "Build a straight beam between any two points, at any angle. Use for bridges, "
                    + "rails, roof ridges, supports, and the diagonal edges of a shape. "
                    + "Thickness makes it a thin line or a thick girder.")
    public static class BuildLine implements Supplier<String> {
        @JsonPropertyDescription("Block id, such as 'oak_log' or 'stone'.")
        public String block = "stone";

        @JsonPropertyDescription("Start X.") public int x1 = 0;
        @JsonPropertyDescription("Start Y.") public int y1 = 0;
        @JsonPropertyDescription("Start Z.") public int z1 = 0;
        @JsonPropertyDescription("End X.") public int x2 = 0;
        @JsonPropertyDescription("End Y.") public int y2 = 0;
        @JsonPropertyDescription("End Z.") public int z2 = 0;

        @JsonPropertyDescription(
                "How thick the beam is, in blocks. 1 is a single line, 3 is a girder. "
                        + "Maximum 16.")
        public int thickness = 1;

        @Override
        public String get() {
            int t = Math.max(1, Math.min(16, thickness));
            // Never below sqrt(3)/2. A block's centre can sit that far from a
            // line passing through its corner, so a thinner beam comes out in
            // pieces on a diagonal — tested, and two of four sample angles
            // broke at half a block. A chunkier bridge beats a bridge with
            // holes in it.
            double half = Math.max(0.87, t / 2.0);
            int pad = t;
            return raise("beam", block,
                    Math.min(x1, x2) - pad, Math.min(y1, y2) - pad, Math.min(z1, z2) - pad,
                    Math.max(x1, x2) + pad, Math.max(y1, y2) + pad, Math.max(z1, z2) + pad,
                    () -> Builder.line(x1, y1, z1, x2, y2, z2, half));
        }
    }

    @JsonClassDescription(
            "Erase a rectangular region back to empty air. Use to hollow out a room after "
                    + "building solid, to cut doors and windows, to flatten ground before "
                    + "building on it, or to undo a mistake. Bedrock is never removed. "
                    + "This is the coordinate version — use it when building, and use the "
                    + "digging tool when the player just wants a hole where you stand.")
    public static class ClearBox implements Supplier<String> {
        @JsonPropertyDescription("One corner: X.") public int x1 = 0;
        @JsonPropertyDescription("One corner: Y.") public int y1 = 0;
        @JsonPropertyDescription("One corner: Z.") public int z1 = 0;
        @JsonPropertyDescription("Opposite corner: X.") public int x2 = 0;
        @JsonPropertyDescription("Opposite corner: Y.") public int y2 = 0;
        @JsonPropertyDescription("Opposite corner: Z.") public int z2 = 0;

        @Override
        public String get() {
            return raise("cleared space", "air", x1, y1, z1, x2, y2, z2,
                    () -> Builder.box(x1, y1, z1, x2, y2, z2, false));
        }
    }
}
