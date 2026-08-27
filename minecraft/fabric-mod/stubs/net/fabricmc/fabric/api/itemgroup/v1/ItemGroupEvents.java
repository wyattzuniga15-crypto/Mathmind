package net.fabricmc.fabric.api.itemgroup.v1;

import net.minecraft.item.Item;
public class ItemGroupEvents {
    public interface Entries { void add(Item i); }
    public interface Modify { void modifyEntries(Entries e); }
    public static class Event { public void register(Modify m) {} }
    public static Event modifyEntriesEvent(Object group) { return new Event(); }
}
