import { ReadableStream } from "stream/web";
import { TextEncoder } from "util";
import { ChatService } from "../chat-service";
import type { ChatCompletionOptions } from "../chat-ai-service";
import OpenAI from "openai/index.mjs";

/**
 * This covers OpenAI or LM Studio—any service that uses the
 * standard chat.completions.create({ stream: true }) interface.
 */
export async function streamOpenAiLike(
    chatId: string,
    assistantMessageId: string,
    userMessage: string,
    chatService: ChatService,
    client: OpenAI,
    options: ChatCompletionOptions
): Promise<ReadableStream<Uint8Array>> {
    const model = options.model || "gpt-4";
    const temperature = typeof options.temperature === "number" ? options.temperature : 0.7;

    const stream = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: userMessage }],
        stream: true,
        temperature,
        max_tokens: options.max_tokens,
        top_p: options.top_p,
        frequency_penalty: options.frequency_penalty,
        presence_penalty: options.presence_penalty,
    });

    let fullResponse = "";
    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        fullResponse += content;
                        controller.enqueue(new TextEncoder().encode(content));
                        await chatService.updateMessageContent(assistantMessageId, fullResponse);
                    }
                }
            } catch (err) {
                controller.error(err);
            } finally {
                controller.close();
            }
        },
    });
}