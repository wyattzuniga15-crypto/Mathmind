package com.anthropic.models.beta.messages;

public final class MessageCreateParams {
    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        public Builder model(String model) { return this; }
        public Builder maxTokens(long tokens) { return this; }
        public Builder putAdditionalHeader(String name, String value) { return this; }
        public Builder system(String system) { return this; }
        public Builder addTool(Class<?> tool) { return this; }
        public Builder addUserMessage(String text) { return this; }
        public Builder addAssistantMessage(String text) { return this; }
        public MessageCreateParams build() { return new MessageCreateParams(); }
    }
}
