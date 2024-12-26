import { ReadableStream } from "stream/web";
import { TextEncoder } from "util";
import { ChatService } from "../chat-service";
import type { ChatCompletionOptions } from "../chat-ai-service";
import OpenAI from "openai/index.mjs";

/**
 * You can either pass in an already-initialized OpenAI instance with x.ai config,
 * or pass in xaiApiKey/baseURL for a new instance. Below is an example that
 * assumes you’ll pass in the prepared `xaiClient`.
 */
export async function streamXai(
    chatId: string,
    assistantMessageId: string,
    userMessage: string,
    chatService: ChatService,
    options: ChatCompletionOptions,
    xaiClient: OpenAI
): Promise<ReadableStream<Uint8Array>> {
    const model = options.model || "grok-beta";
    const temperature = typeof options.temperature === "number" ? options.temperature : 0.7;

    const stream = await xaiClient.chat.completions.create({
        model,
        messages: [
            {
                role: "system",
                content: "You are Grok, a chatbot from the Hitchhiker's Guide to the Galaxy.",
            },
            { role: "user", content: userMessage },
        ],
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
                    const content = chunk.choices?.[0]?.delta?.content || "";
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