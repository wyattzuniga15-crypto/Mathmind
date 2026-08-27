package com.google.gson;

public class JsonObject extends JsonElement {
    public boolean has(String key) { return false; }
    public JsonElement get(String key) { return null; }
    public void add(String key, JsonElement value) {}
    public void addProperty(String key, String value) {}
    public void addProperty(String key, Number value) {}
    public void addProperty(String key, Boolean value) {}
    public JsonArray getAsJsonArray(String key) { return null; }
    public JsonObject getAsJsonObject(String key) { return null; }
}
