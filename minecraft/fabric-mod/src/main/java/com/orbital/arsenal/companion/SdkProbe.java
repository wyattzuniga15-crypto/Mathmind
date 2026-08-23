package com.orbital.arsenal.companion;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;

/**
 * Smallest thing that proves the Anthropic Java SDK is really on the classpath
 * and really bundled into the mod jar.
 *
 * A mod runs inside Minecraft's own classloader alongside Minecraft's own copies
 * of common libraries, so pulling a full HTTP and JSON stack into a mod jar is
 * the part of this feature most likely to break — and it breaks at launch, not
 * at build, which is exactly the kind of failure CI cannot see. Proving the
 * dependency resolves and ships before writing the companion against it costs
 * one build; discovering it afterwards costs the whole feature.
 */
final class SdkProbe {
    private SdkProbe() {}

    static AnthropicClient create(String apiKey) {
        return AnthropicOkHttpClient.builder().apiKey(apiKey).build();
    }
}
