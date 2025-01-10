import { TOGETHER_BASE_URL } from "../constants/provider-defauls";
import type { ProviderPlugin } from "../provider-plugin";
import type { SSEEngineParams } from "../streaming-types";

export class TogetherPlugin implements ProviderPlugin {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey: string, baseUrl?: string) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || TOGETHER_BASE_URL;
    }

    async prepareRequest(params: SSEEngineParams) {
        const { userMessage, options } = params;

        const payload = {
            model: options?.model || "Qwen/Qwen2.5-72B-Instruct-Turbo",
            messages: [{ role: "user", content: userMessage }],
            stream: true,
            max_tokens: options?.max_tokens ?? 1024,
            temperature: typeof options?.temperature === "number" ? options?.temperature : 0.7,
            top_p: options?.top_p ?? 1,
            top_k: options?.top_k ?? 50,
            presence_penalty: options?.presence_penalty ?? 0,
            frequency_penalty: options?.frequency_penalty ?? 0,
        };

        const endpoint = `${this.baseUrl}/chat/completions`;
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok || !response.body) {
            const errorText = await response.text();
            throw new Error(`Together API error: ${response.statusText} - ${errorText}`);
        }

        return response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>
    }

    parseServerSentEvent(line: string): string | null {
        if (!line.startsWith("data:")) return null;
        const jsonString = line.replace(/^data:\s*/, "").trim();

        if (jsonString === "[DONE]") return "[DONE]";

        try {
            const parsed = JSON.parse(jsonString);
            const delta = parsed.choices?.[0]?.delta?.content;
            return delta || null;
        } catch {
            return null;
        }
    }
}