import { ReadableStream } from "stream/web";
import { TextDecoder, TextEncoder } from "util";
import type { StreamParams } from "../provider-types";

/**
 * Groq streaming SSE example.
 * Adapted from the same SSE reading patterns used in Gemini / OpenRouter.
 * 
 * Official docs: https://api.groq.com/openai/v1/chat/completions  (with "stream": true)
 */
export async function streamGroqMessage({
  userMessage,
  assistantMessageId,
  chatService,
  options,
  debug,
  groqApiKey,
  groqBaseUrl,
}: StreamParams & {
  groqApiKey: string;
  groqBaseUrl: string; // e.g. "https://api.groq.com/openai/v1"
  debug?: boolean;
}): Promise<ReadableStream<Uint8Array>> {
  const endpoint = `${groqBaseUrl}/chat/completions`;

  // Build chat payload
  const payload = {
    model: options.model || "llama-3.1-70b-versatile",
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
    stream: true, // <--- crucial
    max_tokens: options.max_tokens ?? 1024,
    temperature: typeof options.temperature === "number" ? options.temperature : 0.7,
    top_p: options.top_p ?? 1,
    frequency_penalty: options.frequency_penalty ?? 0,
    presence_penalty: options.presence_penalty ?? 0,
    // If you want, pass additional Groq params (tool_choice, etc)
  };

  if (debug) console.debug("[groq] Sending request:", payload);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    console.error("[groq] Error from Groq API:", errorText);
    throw new Error(`Groq API error: ${response.statusText}`);
  }

  let fullResponse = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const textChunk = decoder.decode(value, { stream: true });
          if (debug) console.debug("[groq] Raw chunk:", textChunk);
          
          buffer += textChunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (trimmed.startsWith("data:")) {
              const jsonString = trimmed.replace(/^data:\s*/, "");
              if (jsonString === "[DONE]") {
                // SSE signal that streaming is complete
                await chatService.updateMessageContent(assistantMessageId, fullResponse);
                controller.close();
                return;
              }

              try {
                // Groq's chunk shape is similar to OpenAI. See docs for final shape if it differs.
                const parsed = JSON.parse(jsonString);
                // e.g. parsed.choices[0].delta.content
                const delta = parsed.choices?.[0]?.delta?.content ?? "";
                if (delta) {
                  fullResponse += delta;
                  controller.enqueue(new TextEncoder().encode(delta));
                  await chatService.updateMessageContent(assistantMessageId, fullResponse);
                }
              } catch (e) {
                console.error("[groq] SSE parse error:", e);
              }
            }
          }
        }

        // Final flush
        if (fullResponse) {
          await chatService.updateMessageContent(assistantMessageId, fullResponse);
        }
        controller.close();
      } catch (error) {
        console.error("[groq] Stream processing error:", error);
        controller.error(error);
        // Attempt partial save
        if (fullResponse) {
          await chatService.updateMessageContent(assistantMessageId, fullResponse);
        }
      }
    },
  });
}