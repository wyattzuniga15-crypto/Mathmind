package com.anthropic.models.beta.messages;

import java.util.List;
import java.util.Optional;

public final class BetaMessage {
    public List<Block> content() { return List.of(); }

    public static final class Block {
        public Optional<TextBlock> text() { return Optional.empty(); }
    }

    public static final class TextBlock {
        public String text() { return ""; }
    }
}
