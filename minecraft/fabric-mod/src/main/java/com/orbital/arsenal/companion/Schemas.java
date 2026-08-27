package com.orbital.arsenal.companion;

import com.fasterxml.jackson.annotation.JsonClassDescription;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

/**
 * The same tools, described the other way round.
 *
 * The Anthropic SDK reads the annotations on the Tools classes itself. Every
 * other provider wants a JSON blob in OpenAI's shape instead. Rather than
 * write those out by hand — thirteen tools, sixty-odd fields, all of it drifting
 * the moment anyone adds a parameter — this reads the very same annotations by
 * reflection and emits the other format. One definition, two providers, no way
 * for them to disagree.
 */
public final class Schemas {
    private Schemas() {}

    /** Tool name as the model sees it, to the class that implements it. */
    private static final Map<String, Class<? extends Supplier<String>>> TOOLS = new LinkedHashMap<>();

    static {
        add(Tools.FollowMe.class);
        add(Tools.Stay.class);
        add(Tools.ComeHere.class);
        add(Tools.GoTo.class);
        add(Tools.Mine.class);
        add(Tools.AttackNearby.class);
        add(Tools.GiveItem.class);
        add(Tools.FireWeapon.class);
        add(Tools.BuildBox.class);
        add(Tools.BuildSphere.class);
        add(Tools.BuildCylinder.class);
        add(Tools.BuildLine.class);
        add(Tools.ClearBox.class);
    }

    private static void add(Class<? extends Supplier<String>> tool) {
        TOOLS.put(snake(tool.getSimpleName()), tool);
    }

    /** FollowMe becomes follow_me: the name pattern every provider accepts. */
    private static String snake(String name) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (Character.isUpperCase(c)) {
                if (i > 0) {
                    out.append('_');
                }
                out.append(Character.toLowerCase(c));
            } else {
                out.append(c);
            }
        }
        return out.toString();
    }

    /** Every tool, in the shape an OpenAI-compatible endpoint expects. */
    public static JsonArray toolsJson() {
        JsonArray tools = new JsonArray();
        for (Map.Entry<String, Class<? extends Supplier<String>>> entry : TOOLS.entrySet()) {
            JsonObject function = new JsonObject();
            function.addProperty("name", entry.getKey());

            JsonClassDescription about = entry.getValue().getAnnotation(JsonClassDescription.class);
            function.addProperty("description", about == null ? entry.getKey() : about.value());

            JsonObject properties = new JsonObject();
            JsonArray required = new JsonArray();
            for (Field field : entry.getValue().getFields()) {
                if (Modifier.isStatic(field.getModifiers())) {
                    continue;
                }
                JsonObject property = new JsonObject();
                property.addProperty("type", jsonType(field.getType()));
                JsonPropertyDescription note = field.getAnnotation(JsonPropertyDescription.class);
                if (note != null) {
                    property.addProperty("description", note.value());
                }
                properties.add(field.getName(), property);
                // Everything is required. A small model told a field is
                // optional will leave out the coordinates and build at the
                // origin; making it answer for each one is what stops that.
                required.add(field.getName());
            }

            JsonObject schema = new JsonObject();
            schema.addProperty("type", "object");
            schema.add("properties", properties);
            schema.add("required", required);
            function.add("parameters", schema);

            JsonObject wrapper = new JsonObject();
            wrapper.addProperty("type", "function");
            wrapper.add("function", function);
            tools.add(wrapper);
        }
        return tools;
    }

    private static String jsonType(Class<?> type) {
        if (type == int.class || type == long.class || type == Integer.class) {
            return "integer";
        }
        if (type == double.class || type == float.class || type == Double.class) {
            return "number";
        }
        if (type == boolean.class || type == Boolean.class) {
            return "boolean";
        }
        return "string";
    }

    /**
     * Run one tool the model asked for.
     *
     * Never throws: whatever comes back goes to the model as the tool result,
     * and a small model that gets a sentence explaining what it did wrong will
     * usually fix its own call on the next round. An exception here would end
     * the conversation instead.
     */
    public static String run(String name, JsonObject arguments) {
        Class<? extends Supplier<String>> tool = TOOLS.get(name);
        if (tool == null) {
            return "There is no tool called '" + name + "'.";
        }
        try {
            Supplier<String> instance = tool.getDeclaredConstructor().newInstance();
            for (Field field : tool.getFields()) {
                if (Modifier.isStatic(field.getModifiers())
                        || arguments == null
                        || !arguments.has(field.getName())) {
                    continue;
                }
                assign(instance, field, arguments, field.getName());
            }
            return instance.get();
        } catch (ReflectiveOperationException | RuntimeException error) {
            return "That tool could not be run: " + error;
        }
    }

    /**
     * Put one argument into one field.
     *
     * Small models are loose with types — "12" for a number, "True" for a
     * boolean, 8.0 where an int belongs. Reading through the text form and
     * converting deliberately accepts all of that, where asking Gson for the
     * exact type would throw on every one of them.
     */
    private static void assign(Object instance, Field field, JsonObject arguments, String key)
            throws IllegalAccessException {
        String raw = arguments.get(key).getAsString();
        Class<?> type = field.getType();
        if (type == int.class || type == Integer.class) {
            field.setInt(instance, (int) Math.round(Double.parseDouble(raw.trim())));
        } else if (type == long.class) {
            field.setLong(instance, Math.round(Double.parseDouble(raw.trim())));
        } else if (type == double.class || type == Double.class) {
            field.setDouble(instance, Double.parseDouble(raw.trim()));
        } else if (type == float.class) {
            field.setFloat(instance, Float.parseFloat(raw.trim()));
        } else if (type == boolean.class || type == Boolean.class) {
            field.setBoolean(instance, Boolean.parseBoolean(raw.trim()));
        } else {
            field.set(instance, raw);
        }
    }
}
