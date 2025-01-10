import type { ProviderPlugin } from "../provider-plugin";
import type { SSEEngineParams } from "../streaming-types";

interface AnthropicStreamResponse {
    type: string;
    message?: {
        content?: Array<{ text?: string }>;
        stop_reason?: string;
    };
    delta?: {
        text?: string;
    };
    error?: { message: string };
}

/**
 * The new Anthropic plugin
 */
export class AnthropicPlugin implements ProviderPlugin {
    private apiKey: string;
    private version: string;
    private beta?: string;

    constructor(apiKey: string, version: string, beta?: string) {
        this.apiKey = apiKey;
        this.version = version;
        this.beta = beta;
    }

    async prepareRequest(params: SSEEngineParams) {
        const { userMessage, options } = params;

        const body = JSON.stringify({
            model: options?.model || "claude-2",
            messages: [
                {
                    role: "user",
                    content: userMessage,
                },
            ],
            max_tokens: options?.max_tokens ?? 1024,
            temperature: typeof options?.temperature === "number" ? options?.temperature : 1.0,
            top_p: options?.top_p ?? 1,
            top_k: options?.top_k ?? 0,
            stream: true,
        });

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "anthropic-version": this.version,
            "x-api-key": this.apiKey,
        };
        if (this.beta) {
            headers["anthropic-beta"] = this.beta;
        }

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers,
            body,
        });

        if (!response.ok || !response.body) {
            const errorText = await response.text();
            throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        }

        return response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>
    }

    parseServerSentEvent(line: string): string | null {
        // SSE lines are prefixed with "data:" ...
        if (!line.startsWith("data:")) return null;
        const jsonString = line.replace(/^data:\s*/, "").trim();

        // Anthropic uses "[DONE]" to signal the end
        if (jsonString === "[DONE]") return "[DONE]";

        try {
            const parsed = JSON.parse(jsonString) as AnthropicStreamResponse;
            if (parsed.error) {
                throw new Error(`Anthropic SSE error: ${parsed.error.message}`);
            }
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                return parsed.delta.text;
            }
            return null;
        } catch {
            return null;
        }
    }
}