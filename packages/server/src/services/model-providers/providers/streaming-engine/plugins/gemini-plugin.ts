import { ProviderPlugin } from "../../provider-plugin";
import { StreamParams } from "../streaming-types";
import { TextEncoder, TextDecoder } from "util";

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
     * Prepare the SSE request and return a ReadableStream of SSE lines:
     * "data: <chunk>\n\n" ... "data: [DONE]\n\n"
     */
    async prepareRequest(params: StreamParams) {
        const { userMessage, options } = params;



        // 2) Rebuild chat history in Gemini’s expected format
        // const msgs = await chatService.getChatMessages(chatId);
        // const messages = msgs
        //     .filter((m: any) => m.content.trim().length > 0)
        //     .map((m: any) => ({
        //         role: m.role === "assistant" ? "model" : m.role,
        //         parts: [{ text: m.content }],
        //     }));

        // 3) Build the Gemini request payload
        const payload = {
            contents: [
                {
                    parts: [{ text: userMessage, role: "user" }],
                }
            ],
            generationConfig: {
                temperature: typeof options.temperature === "number" ? options.temperature : 0.7,
                maxOutputTokens: options.max_tokens ?? 1024,
                topP: options.top_p ?? 0.9,
                topK: options.top_k ?? 40,
            },
        };

        // 4) Send POST with alt=sse
        const endpoint = `${this.geminiBaseUrl}/${this.modelId}:streamGenerateContent?alt=sse&key=${this.geminiApiKey}`;
        if (options.debug) {
            console.debug("[GeminiPlugin] Sending request:", {
                endpoint,
                payload,
            });
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

        // 5) Convert fetch response into SSE lines
        const reader = response.body.getReader();
        const { readable, writable } = new TransformStream();
        (async () => {
            try {
                const decoder = new TextDecoder();
                const encoder = new TextEncoder();

                let buffer = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    // SSE lines generally split on "\n"
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(":")) continue;

                        if (trimmed.startsWith("data:")) {
                            const jsonString = trimmed.replace(/^data:\s*/, "");
                            if (jsonString === "[DONE]") {
                                // 6) Emit the "done" line so the streaming engine can close
                                const sseDone = `data: [DONE]\n\n`;
                                const writer = writable.getWriter();
                                await writer.write(encoder.encode(sseDone));
                                writer.releaseLock();
                                return;
                            }

                            try {
                                const parsed = JSON.parse(jsonString);
                                // The chunk text is in parsed.candidates[0].content.parts
                                if (parsed.candidates && parsed.candidates[0]?.content?.parts) {
                                    const chunkText = parsed.candidates[0].content.parts
                                        .map((p: any) => p.text)
                                        .join("");

                                    if (chunkText) {
                                        // Emit SSE line with JSON-encoded chunk to preserve newlines
                                        const payloadJson = JSON.stringify(chunkText);
                                        const sseLine = `data: ${payloadJson}\n\n`;

                                        const writer = writable.getWriter();
                                        await writer.write(encoder.encode(sseLine));
                                        writer.releaseLock();
                                    }
                                }
                            } catch (err) {
                                console.error("[GeminiPlugin] SSE JSON parse error:", err);
                            }
                        }
                    }
                }

                // If the stream ended without an explicit [DONE], we can still finalize
                // or optionally emit "data: [DONE]\n\n"
                const writer = writable.getWriter();
                await writer.write(encoder.encode("data: [DONE]\n\n"));
                writer.releaseLock();

                writable.close();
            } catch (error) {
                console.error("[GeminiPlugin] Error reading SSE from Gemini:", error);
                writable.abort(error);
            }
        })();

        return readable;
    }

    /**
     * Parse each SSE line. If it's 'data: [DONE]', we return '[DONE]' so the SSE engine knows to finalize.
     * Otherwise, we JSON-parse the chunk text so we preserve newlines/spaces.
     */
    parseServerSentEvent(line: string): string | null {
        if (!line.startsWith("data: ")) return null;

        const payload = line.slice("data: ".length).trim();
        if (payload === "[DONE]") {
            return "[DONE]";
        }

        try {
            return JSON.parse(payload); // decode the chunk text from JSON
        } catch {
            return payload;
        }
    }
}