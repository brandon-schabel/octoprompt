import { ReadableStream } from "stream/web";
import { TextDecoder, TextEncoder } from "util";
import { StreamParams } from "../provider-types";

interface AnthropicStreamResponse {
    type: string;
    message?: {
        id?: string;
        type?: string;
        role?: string;
        content?: Array<{
            type: string;
            text?: string;
        }>;
        stop_reason?: string;
    };
    index?: number;
    delta?: {
        type?: string;
        text?: string;
    };
    error?: {
        type: string;
        message: string;
    };
    // Additional fields that may appear
    // e.g. "stop_sequence", "usage", "tool_use", etc.
}

export async function streamAnthropic({
    userMessage,
    chatService,
    assistantMessageId,
    options,
    anthropicApiKey,
    anthropicVersion = "2023-06-01",
    anthropicBeta,
}: StreamParams & {
    anthropicApiKey: string;
    anthropicVersion?: string;
    anthropicBeta?: string;
} & { debug?: boolean } // ADDED - optional debug
): Promise<ReadableStream<Uint8Array>> {

    if (options.debug) console.debug("[anthropic] Sending request:", { userMessage, options });

    const body = JSON.stringify({
        model: options.model || "claude-3", // or your desired default
        messages: [
            {
                role: "user",
                content: userMessage,
            },
        ],
        max_tokens: options.max_tokens ?? 1024,
        temperature: typeof options.temperature === "number" ? options.temperature : 1.0,
        top_p: options.top_p ?? 1,
        top_k: options.top_k ?? 0,
        stream: true,
    });

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "anthropic-version": anthropicVersion,
        "x-api-key": anthropicApiKey,
    };
    if (anthropicBeta) {
        // If you need a beta version (optional); multiple betas can be comma-separated
        headers["anthropic-beta"] = anthropicBeta;
    }

    // Perform the streaming fetch to Anthropic
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers,
        body,
    });

    if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullResponse = "";
    let buffer = "";

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    if (options.debug) console.debug("[anthropic] Raw chunk:", chunk); // ADDED

                    buffer += chunk;

                    // We split by newlines, parse lines that start with "data:"
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(":")) {
                            // skip any empty lines or ping events
                            continue;
                        }

                        if (trimmed.startsWith("data:")) {
                            const jsonString = trimmed.replace(/^data:\s*/, "").trim();
                            // Anthropic uses "[DONE]" to signal the end of the stream
                            if (jsonString === "[DONE]") {
                                break;
                            }

                            try {
                                const parsed = JSON.parse(jsonString) as AnthropicStreamResponse;
                                if (options.debug) console.debug("[anthropic] Parsed chunk:", parsed); // ADDED

                                // If there's an error event
                                if (parsed.error) {
                                    throw new Error(`Anthropic SSE error: ${parsed.error.message}`);
                                }

                                // The content deltas appear in content_block_delta events
                                if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                                    const text = parsed.delta.text || "";
                                    if (text) {
                                        fullResponse += text;
                                        controller.enqueue(new TextEncoder().encode(text));
                                        await chatService.updateMessageContent(assistantMessageId, fullResponse);
                                    }
                                }

                                // In some cases, you might see assistant "role" messages with text. Adjust as needed.
                                // If partial text can also appear in other fields, parse those as well.

                            } catch (err) {
                                console.error("Failed to parse Anthropic SSE chunk:", err);
                            }
                        }
                    }
                }

                // Process any leftover buffer chunk if needed
                const trimmedBuffer = buffer.trim();
                if (trimmedBuffer && trimmedBuffer.startsWith("data:")) {
                    const leftoverJson = trimmedBuffer.replace(/^data:\s*/, "").trim();
                    if (leftoverJson !== "[DONE]") {
                        try {
                            const parsed = JSON.parse(leftoverJson) as AnthropicStreamResponse;
                            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                                const text = parsed.delta.text || "";
                                if (text) {
                                    fullResponse += text;
                                    controller.enqueue(new TextEncoder().encode(text));
                                    await chatService.updateMessageContent(assistantMessageId, fullResponse);
                                }
                            }
                        } catch (err) {
                            console.error("Failed to parse leftover buffer:", err);
                        }
                    }
                }

                // Final DB update
                await chatService.updateMessageContent(assistantMessageId, fullResponse);
                controller.close();
            } catch (err) {
                console.error("Error in Anthropic stream:", err);
                controller.error(err);
            }
        },
    });
}