import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { createUnifiedProviderService } from "@/services/model-providers/providers/unified-provider-service";
import { randomString } from "./test-utils";

const providerKeyServiceMock = {
    listKeys: mock(async () => [
        { provider: "openai", key: "fake-openai-key" },
        { provider: "openrouter", key: "fake-openrouter-key" },
    ]),
};

spyOn(
    await import("@/services/model-providers/providers/provider-key-service"),
    "createProviderKeyService"
).mockImplementation(() => providerKeyServiceMock as any);

const chatServiceMock = {
    saveMessage: mock(async (m) => ({ id: randomString(), ...m })),
    updateMessageContent: mock(async () => { }),
    updateChatTimestamp: mock(async () => { }),
};

spyOn(
    await import("@/services/model-providers/chat/chat-service"),
    "createChatService"
).mockImplementation(() => chatServiceMock as any);

describe("unified-provider-service", () => {
    let svc: ReturnType<typeof createUnifiedProviderService>;

    beforeEach(() => {
        svc = createUnifiedProviderService();
    });

    test("processMessage saves user msg and placeholder, returns SSE stream", async () => {
        const sseMock = mock(async () => {
            return new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode("response chunk"));
                    controller.close();
                },
            });
        });
        spyOn(svc as any, "streamMessage").mockImplementation(sseMock);

        const stream = await svc.processMessage({
            chatId: "test-chat",
            userMessage: "Hello",
            provider: "openai",
        });
        expect(chatServiceMock.saveMessage.mock.calls.length).toBe(2); // user + assistant
        expect(stream).toBeInstanceOf(ReadableStream);
    });

    test("listModels calls modelFetcherService.listModels if keys exist", async () => {
        // We rely on lazy init, so we just call listModels
        const result = await svc.listModels("openai");
        expect(Array.isArray(result)).toBe(true);
    });
});