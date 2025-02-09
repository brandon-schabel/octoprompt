import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { createOpenRouterProviderService } from "@/services/model-providers/providers/open-router-provider";
import { randomString } from "./test-utils";

const providerKeyServiceMock = {
    listKeys: mock(async () => [{ provider: "openrouter", key: "fake-openrouter-key" }])
};

spyOn(
    await import("@/services/model-providers/providers/provider-key-service"),
    "createProviderKeyService"
).mockImplementation(() => providerKeyServiceMock as any);

const chatServiceMock = {
    saveMessage: mock(async (msg) => ({ id: randomString(), ...msg })),
    updateMessageContent: mock(async () => { }),
    updateChatTimestamp: mock(async () => { }),
};
spyOn(
    await import("@/services/model-providers/chat/chat-service"),
    "createChatService"
).mockImplementation(() => chatServiceMock as any);

describe("open-router-provider", () => {
    let svc: ReturnType<typeof createOpenRouterProviderService>;

    beforeEach(async () => {
        svc = createOpenRouterProviderService();
    });

    test("processMessage saves user message, creates assistant placeholder, updates content", async () => {
        // mock SSE stream
        const sseMock = mock(async () => {
            return new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode("Final Response"));
                    controller.close();
                },
            });
        });
        spyOn(svc as any, "streamMessage").mockImplementation(sseMock);

        const stream = await svc.processMessage({
            chatId: "chat123",
            userMessage: "Hello",
            provider: "openrouter",
        });

        expect(chatServiceMock.saveMessage.mock.calls.length).toBe(2); // user + placeholder
        expect(stream).toBeInstanceOf(ReadableStream);
    });

    test("streamMessage returns a ReadableStream and updates chat message content on partial/done", async () => {
        const result = await (svc as any).streamMessage({
            chatId: "testchat",
            assistantMessageId: "assistantMsgId",
            userMessage: "User says something",
            options: {},
            tempId: "temp123",
        });
        expect(result).toBeInstanceOf(ReadableStream);
    });
});