import { GROQ_BASE_URL } from "../constants/provider-defauls";
import type { ProviderPlugin } from "../provider-plugin";
import type { SSEEngineParams } from "../streaming-types";

export class GroqPlugin implements ProviderPlugin {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey: string, baseUrl?: string) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || GROQ_BASE_URL;
    }

    async prepareRequest(params: SSEEngineParams) {
        const { userMessage, options } = params;

        const payload = {
            model: options?.model || "llama-3.1-70b-versatile",
            messages: [{ role: "user", content: userMessage }],
            stream: true,
            max_tokens: options?.max_tokens ?? 1024,
            temperature: typeof options?.temperature === "number" ? options?.temperature : 0.7,
            top_p: options?.top_p ?? 1,
            frequency_penalty: options?.frequency_penalty ?? 0,
            presence_penalty: options?.presence_penalty ?? 0,
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
            throw new Error(`Groq API error: ${response.statusText} - ${errorText}`);
        }

        return response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>
    }

    parseServerSentEvent(line: string): string | null {
        if (!line.startsWith("data:")) return null;
        const jsonString = line.replace(/^data:\s*/, "").trim();

        if (jsonString === "[DONE]") return "[DONE]";

        try {
            const parsed = JSON.parse(jsonString);
            // e.g. parsed.choices[0].delta.content
            const content = parsed.choices?.[0]?.delta?.content;
            return content || null;
        } catch {
            return null;
        }
    }
}