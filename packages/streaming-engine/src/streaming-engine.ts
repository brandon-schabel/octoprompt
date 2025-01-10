import type { SSEEngineParams } from "./streaming-types";

/**
 * Create a streaming SSE with the given plugin + params + handlers.
 * This function does NOT know anything about ChatService or other external concerns.
 * All updates go out via the handlers/callbacks.
 */
export async function createSSEStream(params: SSEEngineParams): Promise<ReadableStream<Uint8Array>> {
    const { plugin, systemMessage, userMessage, handlers, options } = params;

    let streamOrReader: ReadableStream<Uint8Array> | ReadableStreamDefaultReader<Uint8Array>;
    try {
        streamOrReader = await plugin.prepareRequest({
            userMessage,
            systemMessage,
            options,
            handlers,
            plugin,
        });
    } catch (error) {
        // If the plugin fails immediately, call onError
        if (handlers.onError) {
            handlers.onError(error, {
                role: "assistant",
                content: "", // or partial content if any
            });
        }
        // Return an empty closed stream so the caller can still consume something
        return new ReadableStream<Uint8Array>({
            start(controller) {
                controller.close();
            },
        });
    }

    // Fire off system message handler if present
    if (systemMessage && handlers.onSystemMessage) {
        handlers.onSystemMessage({
            role: "system",
            content: systemMessage,
        });
    }

    // Fire off user message handler if present
    if (handlers.onUserMessage) {
        handlers.onUserMessage({
            role: "user",
            content: userMessage,
        });
    }

    // Prepare the SSE request with the plugin
    // const streamOrReader = await plugin.prepareRequest({
    //     userMessage,
    //     options: options ?? {},
    //     plugin,
    //     handlers,
    //     systemMessage
    //     // If your plugin needs more, pass them here
    //     // chatId: "",
    //     // assistantMessageId: "",
    // });

    // unify the reader (some plugins return a ReadableStream, others return a Reader directly)
    const reader =
        streamOrReader instanceof ReadableStream
            ? streamOrReader.getReader()
            : streamOrReader;

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let fullResponse = ""; // accumulate all assistant text for onDone
    let buffer = "";

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // Decode chunk
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    // Split SSE events by double-newline
                    const events = buffer.split("\n\n");
                    buffer = events.pop() ?? ""; // leftover partial event

                    // Process each SSE event
                    for (const event of events) {
                        // Split each event by newline, ignoring comment lines
                        const lines = event
                            .split("\n")
                            .map(line => line.trim())
                            .filter(line => !!line && !line.startsWith(":"));

                        if (lines.length === 0) {
                            continue;
                        }

                        let eventText = "";
                        for (const line of lines) {
                            const parsedText = plugin.parseServerSentEvent(line);

                            if (parsedText === "[DONE]") {
                                // SSE end marker
                                if (handlers.onDone) {
                                    handlers.onDone({
                                        role: "assistant",
                                        content: fullResponse,
                                    });
                                }
                                controller.close();
                                return;
                            }
                            if (parsedText) {
                                eventText += parsedText;
                            }
                        }

                        // If there was text in this event, append to full and call partial
                        if (eventText) {
                            fullResponse += eventText;
                            controller.enqueue(encoder.encode(eventText));

                            if (handlers.onPartial) {
                                handlers.onPartial({
                                    role: "assistant",
                                    content: eventText,
                                });
                            }
                        }
                    }
                }

                // Handle leftover partial event in the buffer
                if (buffer.trim()) {
                    const lines = buffer
                        .split("\n")
                        .map(line => line.trim())
                        .filter(line => !!line && !line.startsWith(":"));

                    let leftoverText = "";
                    for (const line of lines) {
                        const parsedText = plugin.parseServerSentEvent(line);
                        if (parsedText === "[DONE]") {
                            if (handlers.onDone) {
                                handlers.onDone({
                                    role: "assistant",
                                    content: fullResponse,
                                });
                            }
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

                        if (handlers.onPartial) {
                            handlers.onPartial({
                                role: "assistant",
                                content: leftoverText,
                            });
                        }
                    }
                }

                // Done reading; finalize
                if (handlers.onDone) {
                    handlers.onDone({
                        role: "assistant",
                        content: fullResponse,
                    });
                }
                controller.close();
            } catch (error) {
                controller.error(error);
                if (handlers.onError) {
                    handlers.onError(error, {
                        role: "assistant",
                        content: fullResponse,
                    });
                }
            }
        },
    });
}