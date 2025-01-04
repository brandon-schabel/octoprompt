import { ReadableStream } from "stream/web";
import { TextEncoder, TextDecoder } from "util"; // ADDED TextDecoder
import type { StreamParams } from "../provider-types";

type OpenRouterStreamResponse = {
    choices: {
        delta?: { content?: string };
        content?: string;
    }[];
};


const DEFAULT_MODEL = "deepseek/deepseek-chat";

export async function streamOpenRouter({
    userMessage,
    chatService,
    assistantMessageId,
    options,
    openRouterApiKey,
    systemMessage,
    debug,
}: StreamParams & {
    openRouterApiKey: string;
    systemMessage?: string;
    debug?: boolean;
}): Promise<ReadableStream<Uint8Array>> {
    if (options.debug) console.debug("[openrouter] Sending request:", { userMessage, options });

    // Build the messages array
    // If `systemMessage` exists, push it first
    const messages = [];
    if (systemMessage) {
        messages.push({ role: "system", content: systemMessage });
    }
    // Then user message
    messages.push({ role: "user", content: userMessage });


    const model = options.model || DEFAULT_MODEL;

    if (!options.model) {
        console.error(`No model provided for OpenRouter stream, using ${DEFAULT_MODEL}`);
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            "HTTP-Referer": "http://localhost:3579",
            "X-Title": "OctoPrompt",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            messages,
            stream: true,
            ...options,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.statusText} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("No response body available for streaming");
    }

    let fullResponse = "";
    let buffer = "";
    const decoder = new TextDecoder();

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    if (debug) console.debug("[openrouter] Raw chunk:", chunk);

                    buffer += chunk;
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(":")) continue;

                        if (trimmed.startsWith("data:")) {
                            const jsonString = trimmed.replace(/^data:\s*/, "").trim();
                            if (jsonString === "[DONE]") break;

                            try {
                                const parsed = JSON.parse(jsonString) as OpenRouterStreamResponse;
                                if (debug) console.debug("[openrouter] Parsed chunk:", parsed);

                                const content = parsed.choices?.[0]?.delta?.content || "";
                                if (content.length > 0) {
                                    fullResponse += content;
                                    controller.enqueue(new TextEncoder().encode(content));
                                    await chatService.updateMessageContent(assistantMessageId, fullResponse);
                                }
                            } catch (err) {
                                console.error("Failed to parse OpenRouter SSE chunk:", err);
                            }
                        }
                    }
                }

                // Leftover buffer check
                if (buffer.trim()) {
                    try {
                        const trimmed = buffer.trim();
                        if (trimmed.startsWith("data:")) {
                            const jsonString = trimmed.replace(/^data:\s*/, "").trim();
                            if (jsonString !== "[DONE]") {
                                const parsed = JSON.parse(jsonString) as OpenRouterStreamResponse;
                                const content = parsed.choices?.[0]?.delta?.content || "";
                                if (content.length > 0) {
                                    fullResponse += content;
                                    controller.enqueue(new TextEncoder().encode(content));
                                }
                            }
                        }
                    } catch (err) {
                        console.error("Failed to parse final buffer chunk:", err);
                    }
                }

                // Final DB update with complete message
                await chatService.updateMessageContent(assistantMessageId, fullResponse);
                controller.close();
            } catch (err) {
                console.error("Error in OpenRouter stream:", err);
                controller.error(err);
            }
        },
    });
}