import { ReadableStream } from "stream/web";
import { TextEncoder, TextDecoder } from "util"; // ADDED - import TextDecoder
import type { StreamParams } from "../provider-types";

export async function streamOllama({
    userMessage,
    chatService,
    assistantMessageId,
    options,
    ollamaBaseUrl
}: StreamParams & {
    ollamaBaseUrl: string
} & { debug?: boolean } // ADDED - optional debug
): Promise<ReadableStream<Uint8Array>> {

    if (options.debug) console.debug("[ollama] Sending request:", { userMessage, options });

    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: options.model || "llama3:latest",
            messages: [{ role: "user", content: userMessage }],
            stream: true,
            ...options,
        }),
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
    }

    let fullResponse = "";
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("No response body available for streaming");
    }

    const decoder = new TextDecoder();

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                let buffer = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    if (options.debug) console.debug("[ollama] Raw chunk:", chunk); // ADDED

                    buffer += chunk;
                    const lines = buffer.split("\n").filter((line) => line.trim());
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);
                            if (options.debug) console.debug("[ollama] Parsed line:", data); // ADDED

                            if (data.message?.content) {
                                fullResponse += data.message.content;
                            }
                        } catch {
                            // Ignore partial lines
                        }
                    }

                    await chatService.updateMessageContent(assistantMessageId, fullResponse);
                    controller.enqueue(new TextEncoder().encode(chunk));
                }

                // Final update if leftover
                if (buffer.trim()) {
                    try {
                        const data = JSON.parse(buffer.trim());
                        if (data.message?.content) {
                            fullResponse += data.message.content;
                            await chatService.updateMessageContent(assistantMessageId, fullResponse);
                        }
                        controller.enqueue(new TextEncoder().encode(buffer));
                    } catch {
                        // Ignore parse errors at the end
                    }
                }

                controller.close();
            } catch (err) {
                controller.error(err);
            }
        },
    });
}