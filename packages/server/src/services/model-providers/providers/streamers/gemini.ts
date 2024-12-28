import { ReadableStream } from "stream/web";
import { TextDecoder, TextEncoder } from "util";
import type { StreamParams } from "../provider-types";

type GeminiStreamParams = Omit<StreamParams, "assistantMessageId"> & {
    tempId?: string;
    geminiApiKey: string;
    geminiBaseUrl: string;
    modelId: string;
};

export async function streamGeminiMessage({
    chatId,
    userMessage,
    chatService,
    options,
    assistantMessageId,
    geminiApiKey,
    geminiBaseUrl,
    modelId,
}: GeminiStreamParams & { assistantMessageId: string } & { debug?: boolean } // ADDED
): Promise<ReadableStream<Uint8Array>> {

    if (options.debug) console.debug("[gemini] Sending request:", { userMessage, options, modelId });

    // Save user message
    await chatService.saveMessage({
        chatId,
        role: "user",
        content: userMessage,
    });
    await chatService.updateChatTimestamp(chatId);

    // Reconstruct chat history
    const msgs = await chatService.getChatMessages(chatId);
    const messages = msgs
        .filter((m) => m.content.trim().length > 0)
        .map((m) => ({
            role: m.role === "assistant" ? "model" : m.role,
            parts: [{ text: m.content }],
        }));

    // Payload
    const payload = {
        contents: messages,
        generationConfig: {
            temperature: typeof options.temperature === "number" ? options.temperature : 0.7,
            maxOutputTokens: options.max_tokens ?? 1024,
            topP: options.top_p ?? 0.9,
            topK: options.top_k ?? 40,
        },
    };

    const endpoint = `${geminiBaseUrl}/${modelId}:streamGenerateContent?alt=sse&key=${geminiApiKey}`;
    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
        console.error("Gemini API error response:", await response.text());
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    let fullResponse = "";
    const reader = response.body.getReader();

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            const decoder = new TextDecoder();
            try {
                let buffer = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const text = decoder.decode(value, { stream: true });
                    if (options.debug) console.debug("[gemini] Raw chunk:", text); // ADDED

                    buffer += text;
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(":")) {
                            continue;
                        }

                        if (trimmed.startsWith("data:")) {
                            const jsonString = trimmed.replace(/^data:\s*/, "");
                            if (jsonString === "[DONE]") {
                                await chatService.updateMessageContent(assistantMessageId, fullResponse);
                                controller.close();
                                return;
                            }

                            try {
                                const parsed = JSON.parse(jsonString);
                                if (parsed.candidates && parsed.candidates[0]?.content?.parts) {
                                    const chunkText = parsed.candidates[0].content.parts
                                        .map((p: any) => p.text)
                                        .join("");
                                    if (chunkText) {
                                        fullResponse += chunkText;
                                        controller.enqueue(new TextEncoder().encode(chunkText));
                                        await chatService.updateMessageContent(assistantMessageId, fullResponse);
                                    }
                                }
                            } catch (e) {
                                console.error("Error parsing Gemini SSE JSON:", e);
                            }
                        }
                    }
                }

                // Final update if anything is left
                if (fullResponse) {
                    await chatService.updateMessageContent(assistantMessageId, fullResponse);
                }
                controller.close();
            } catch (error) {
                console.error("Error in Gemini stream processing:", error);
                controller.error(error);

                // Ensure partial content is persisted
                if (fullResponse) {
                    await chatService.updateMessageContent(assistantMessageId, fullResponse);
                }
            }
        },
    });
}