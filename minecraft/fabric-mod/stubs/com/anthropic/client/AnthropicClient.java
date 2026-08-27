package com.anthropic.client;

import com.anthropic.models.beta.messages.BetaMessage;
import com.anthropic.models.beta.messages.MessageCreateParams;

public interface AnthropicClient {
    Beta beta();

    interface Beta { Messages messages(); }

    interface Messages {
        Iterable<BetaMessage> toolRunner(MessageCreateParams params);
    }
}
