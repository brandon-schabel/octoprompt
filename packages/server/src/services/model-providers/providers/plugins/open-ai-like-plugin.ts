import { ProviderPlugin } from "../provider-plugin";
import { StreamParams } from "../provider-types";
import { TextEncoder } from "util";
import OpenAI from "openai";

export class OpenAiLikePlugin implements ProviderPlugin {
    private client: OpenAI;
    private defaultModel: string;

    constructor(client: OpenAI, defaultModel: string) {
        this.client = client;
        this.defaultModel = defaultModel;
    }

    async prepareRequest(params: StreamParams) {
        const { userMessage, chatService, chatId, options } = params;

        // Save user message, etc. (no partial updates here; SSE engine does that)
        await chatService.saveMessage({
            chatId,
            role: "user",
            content: userMessage,
        });
        await chatService.updateChatTimestamp(chatId);

        const model = options.model || this.defaultModel;
        const temperature = typeof options.temperature === "number" ? options.temperature : 0.7;

        if (options.debug) {
            console.debug("[OpenAiLikePlugin] Sending request:", { userMessage, options });
        }

        // Call OpenAI with streaming
        const openaiStream = await this.client.chat.completions.create({
            model,
            messages: [
                { role: "user", content: userMessage },
            ],
            stream: true,
            temperature,
            max_tokens: options.max_tokens,
            top_p: options.top_p,
            frequency_penalty: options.frequency_penalty,
            presence_penalty: options.presence_penalty,
        });

        // Turn the async iterator into a TransformStream that emits SSE lines
        const { readable, writable } = new TransformStream();
        (async () => {
            try {
                const encoder = new TextEncoder();

                for await (const chunk of openaiStream) {
                    if (options.debug) {
                        console.debug("[OpenAiLikePlugin] SSE chunk:", chunk);
                    }

                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        // JSON-encode so we don’t break on embedded newlines
                        const jsonPayload = JSON.stringify(content);
                        // SSE event lines: "data: ...\n\n"
                        const sseLine = `data: ${jsonPayload}\n\n`;

                        const writer = writable.getWriter();
                        await writer.write(encoder.encode(sseLine));
                        writer.releaseLock();
                    }
                }

                // Done signal
                const writer = writable.getWriter();
                await writer.write(encoder.encode("data: [DONE]\n\n"));
                writer.releaseLock();

                writable.close();
            } catch (err) {
                console.error("OpenAiLike streaming error:", err);
                writable.abort(err);
            }
        })();

        return readable;
    }

    parseServerSentEvent(line: string): string | null {
        // Same SSE approach as XAIPlugin
        if (!line.startsWith("data: ")) return null;

        const payload = line.slice("data: ".length).trim();

        if (payload === "[DONE]") {
            return "[DONE]";
        }

        // Otherwise, parse the JSON text
        try {
            return JSON.parse(payload);
        } catch {
            // If JSON parse fails, fallback
            return payload;
        }
    }
}