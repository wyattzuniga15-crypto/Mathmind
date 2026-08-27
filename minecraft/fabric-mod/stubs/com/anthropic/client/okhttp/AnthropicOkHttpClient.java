package com.anthropic.client.okhttp;

import com.anthropic.client.AnthropicClient;

public final class AnthropicOkHttpClient {
    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        public Builder apiKey(String key) { return this; }
        public AnthropicClient build() { return null; }
    }
}
