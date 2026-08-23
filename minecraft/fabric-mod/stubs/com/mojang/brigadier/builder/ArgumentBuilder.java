package com.mojang.brigadier.builder;

import com.mojang.brigadier.Command;

public abstract class ArgumentBuilder<S, T extends ArgumentBuilder<S, T>> {
    @SuppressWarnings("unchecked")
    public T then(ArgumentBuilder<S, ?> child) { return (T) this; }
    @SuppressWarnings("unchecked")
    public T executes(Command<S> command) { return (T) this; }
}
