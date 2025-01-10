import type { ProviderPlugin } from "../provider-plugin";
import type { SSEEngineParams } from "../streaming-types";

export class GeminiPlugin implements ProviderPlugin {
    private geminiApiKey: string;
    private geminiBaseUrl: string;
    private modelId: string;

    constructor(
        geminiApiKey: string,
        geminiBaseUrl: string,
        modelId: string
    ) {
        this.geminiApiKey = geminiApiKey;
        this.geminiBaseUrl = geminiBaseUrl;
        this.modelId = modelId;
    }

    /**
     * Prepare the SSE request. Return a ReadableStream<Uint8Array> so the test
     * can do `const reader = (await plugin.prepareRequest(...)).getReader()`.
     */
    async prepareRequest(params: SSEEngineParams): Promise<ReadableStream<Uint8Array>> {
        const { userMessage, options } = params;

        // NOTE: remove "role" from parts[]. Gemini doesn't accept it.
        const payload = {
            contents: [
                {
                    parts: [{ text: userMessage }],
                },
            ],
            generationConfig: {
                temperature:
                    typeof options?.temperature === "number" ? options?.temperature : 0.7,
                maxOutputTokens: options?.max_tokens ?? 1024,
                topP: options?.top_p ?? 0.9,
                topK: options?.top_k ?? 40,
            },
        };

        const endpoint = `${this.geminiBaseUrl}/${this.modelId}:streamGenerateContent?alt=sse&key=${this.geminiApiKey}`;
        if (options?.debug) {
            console.debug("[GeminiPlugin] Sending request:", { endpoint, payload });
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok || !response.body) {
            console.error("Gemini API error response:", await response.text());
            throw new Error(`Gemini API error: ${response.statusText}`);
        }

        // Return a ReadableStream that passes through the SSE chunks from Gemini.
        return new ReadableStream<Uint8Array>({
            start: async (controller) => {
                try {
                    const reader = response.body?.getReader();
                    if (!reader) {
                        throw new Error("Failed to get reader from response body");
                    }
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            controller.close();
                            break;
                        }
                        controller.enqueue(value!);
                    }
                } catch (err) {
                    controller.error(err);
                }
            },
        });
    }

    /**
     * parseServerSentEvent: for each SSE line like:
     *   data: {"candidates":[{"content":{"parts":[{"text":"Hello "}]}}]}
     * we JSON-parse, then return the aggregated text.
     */
    parseServerSentEvent(line: string): string | null {
        if (!line.startsWith("data:")) return null;
        const jsonString = line.replace(/^data:\s*/, "").trim();

        if (jsonString === "[DONE]") {
            return "[DONE]";
        }

        try {
            const parsed = JSON.parse(jsonString);
            const parts = parsed.candidates?.[0]?.content?.parts;
            if (!parts || parts.length === 0) return null;

            const chunkText = parts.map((p: any) => p.text).join("");
            return chunkText || null;
        } catch {
            return null; // invalid JSON => test expects null
        }
    }
}