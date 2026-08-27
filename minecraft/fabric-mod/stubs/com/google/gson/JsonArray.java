package com.google.gson;

public class JsonArray extends JsonElement implements Iterable<JsonElement> {
    public void add(JsonElement value) {}
    public void add(String value) {}
    public int size() { return 0; }
    public boolean isEmpty() { return true; }
    public JsonElement get(int index) { return null; }
    @Override
    public java.util.Iterator<JsonElement> iterator() { return java.util.List.<JsonElement>of().iterator(); }
}
