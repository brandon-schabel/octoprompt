import { ReadableStream } from "stream/web";
import { TextDecoder, TextEncoder } from "util";
import type { StreamParams } from "../provider-types";

/**
 * Together.ai streaming SSE example.
 * Official docs: https://api.together.xyz/v1/chat/completions  (with "stream": true)
 */
export async function streamTogetherMessage({
    userMessage,
    assistantMessageId,
    chatService,
    options,
    debug,
    togetherApiKey,
    togetherBaseUrl,
}: StreamParams & {
    togetherApiKey: string;
    togetherBaseUrl: string; // e.g. "https://api.together.xyz/v1"
    debug?: boolean;
}): Promise<ReadableStream<Uint8Array>> {
    const endpoint = `${togetherBaseUrl}/chat/completions`;

    // Build chat payload
    const payload = {
        model: options.model || "Qwen/Qwen2.5-72B-Instruct-Turbo",
        messages: [
            {
                role: "user",
                content: userMessage,
            },
        ],
        stream: true, // <--- crucial
        max_tokens: options.max_tokens ?? 1024,
        temperature: typeof options.temperature === "number" ? options.temperature : 0.7,
        top_p: options.top_p ?? 1,
        top_k: options.top_k ?? 50, // if desired
        presence_penalty: options.presence_penalty ?? 0,
        frequency_penalty: options.frequency_penalty ?? 0,
    };

    if (debug) console.debug("[together] Sending request:", payload);

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${togetherApiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
        const errorText = await response.text();
        console.error("[together] Error from Together API:", errorText);
        throw new Error(`Together API error: ${response.statusText}`);
    }

    let fullResponse = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const textChunk = decoder.decode(value, { stream: true });
                    if (debug) console.debug("[together] Raw chunk:", textChunk);

                    buffer += textChunk;
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(":")) continue;
                        if (trimmed.startsWith("data:")) {
                            const jsonString = trimmed.replace(/^data:\s*/, "");
                            if (jsonString === "[DONE]") {
                                // SSE signal that streaming is complete
                                await chatService.updateMessageContent(assistantMessageId, fullResponse);
                                controller.close();
                                return;
                            }
                            try {
                                // The shape is typically { choices: [{ delta: { content: ...} }] }
                                // Adjust parsing if their SSE shape differs
                                const parsed = JSON.parse(jsonString);
                                const delta = parsed.choices?.[0]?.delta?.content ?? "";
                                if (delta) {
                                    fullResponse += delta;
                                    controller.enqueue(new TextEncoder().encode(delta));
                                    await chatService.updateMessageContent(assistantMessageId, fullResponse);
                                }
                            } catch (e) {
                                console.error("[together] SSE parse error:", e);
                            }
                        }
                    }
                }

                // Final flush
                if (fullResponse) {
                    await chatService.updateMessageContent(assistantMessageId, fullResponse);
                }
                controller.close();
            } catch (error) {
                console.error("[together] Stream processing error:", error);
                controller.error(error);
                // Attempt partial save
                if (fullResponse) {
                    await chatService.updateMessageContent(assistantMessageId, fullResponse);
                }
            }
        },
    });
}