import { ReadableStream } from "stream/web";
import { TextEncoder } from "util";
import type { StreamParams } from "../provider-types";
import OpenAI from "openai/index.mjs";

type OpenAILikeParams = StreamParams & {
    provider: "openai" | "lmstudio";
    client: OpenAI;
};

/**
 * This covers OpenAI or LM Studio—any service that uses the
 * standard chat.completions.create({ stream: true }) interface.
 */
export async function streamOpenAiLike({
    userMessage,
    chatService,
    assistantMessageId,
    options,
    client,
}: OpenAILikeParams): Promise<ReadableStream<Uint8Array>> {
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