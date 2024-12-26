import { ReadableStream } from "stream/web";
import { TextDecoder, TextEncoder } from "util";
import { ChatService } from "../chat-service";
import type { ChatCompletionOptions } from "../chat-ai-service";

export async function streamOllama(
    chatId: string,
    assistantMessageId: string,
    userMessage: string,
    chatService: ChatService,
    options: ChatCompletionOptions,
    ollamaBaseUrl: string
): Promise<ReadableStream<Uint8Array>> {
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
                    buffer += chunk;
                    const lines = buffer.split("\n").filter((line) => line.trim());
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);
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