import { ReadableStream } from "stream/web";
import { ProviderPlugin } from "../provider-plugin";
import { StreamParams } from "./streaming-types";
import { ChatService } from "../../chat/chat-service";

export async function createSSEStream(
    plugin: ProviderPlugin,
    streamParams: StreamParams & { chatService: ChatService }
): Promise<ReadableStream<Uint8Array>> {
    const { chatService, assistantMessageId } = streamParams;
    const streamOrReader = await plugin.prepareRequest(streamParams);

    const reader =
        streamOrReader instanceof ReadableStream
            ? streamOrReader.getReader()
            : streamOrReader;

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let fullResponse = "";
    let buffer = "";

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // Decode what we read so far
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    // 1) Split SSE **events** by double-newline.
                    //    Each "event" can contain one or more lines:
                    //      data: ...
                    //      data: ...
                    //    Then a blank line: \n\n
                    const events = buffer.split("\n\n");
                    buffer = events.pop() ?? ""; // any partial event left in `buffer`

                    for (const event of events) {
                        // 2) Split each event by single newlines, ignoring comment lines, etc.
                        const lines = event
                            .split("\n")
                            .map(line => line.trim())
                            .filter(line => !!line && !line.startsWith(":"));

                        if (lines.length === 0) {
                            continue;
                        }

                        // 3) Collect all `data:` lines into a single chunk (some SSE events have multiple data lines)
                        let eventText = "";
                        for (const line of lines) {
                            const parsedText = plugin.parseServerSentEvent(line);
                            if (parsedText === "[DONE]") {
                                // End-of-stream marker
                                await chatService.updateMessageContent(assistantMessageId, fullResponse);
                                controller.close();
                                return;
                            }
                            if (parsedText) {
                                eventText += parsedText;
                            }
                        }

                        // 4) If we got some text, append & send partial updates
                        if (eventText) {
                            fullResponse += eventText;
                            controller.enqueue(encoder.encode(eventText));
                            await chatService.updateMessageContent(assistantMessageId, fullResponse);
                        }
                    }
                }

                // Handle any leftover partial event
                if (buffer.trim()) {
                    // Optionally, parse if you suspect there's a last partial event
                    const lines = buffer
                        .split("\n")
                        .map(line => line.trim())
                        .filter(line => !!line && !line.startsWith(":"));

                    let leftoverText = "";
                    for (const line of lines) {
                        const parsedText = plugin.parseServerSentEvent(line);
                        if (parsedText === "[DONE]") {
                            await chatService.updateMessageContent(assistantMessageId, fullResponse);
                            controller.close();
                            return;
                        }
                        if (parsedText) {
                            leftoverText += parsedText;
                        }
                    }

                    if (leftoverText) {
                        fullResponse += leftoverText;
                        controller.enqueue(encoder.encode(leftoverText));
                        await chatService.updateMessageContent(assistantMessageId, fullResponse);
                    }
                }

                // Final update
                await chatService.updateMessageContent(assistantMessageId, fullResponse);
                controller.close();
            } catch (error) {
                console.error("SSE streaming error:", error);
                controller.error(error);
                // Save partial content if any
                if (fullResponse) {
                    await chatService.updateMessageContent(assistantMessageId, fullResponse);
                }
            }
        },
    });
}