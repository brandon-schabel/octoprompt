// Recent changes:
// 1. Initial setup for chat API test suite
// 2. Added imports for Bun, Zod, apiFetch, Endpoint, and chat schemas
// 3. Defined BASE_URL and API_URL
// 4. Scaffolding for describe, beforeAll, afterAll, and test data arrays
// 5. Plan to test CRUD operations for chats and messages, plus forking and AI chat.

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { z } from 'zod'
import { apiFetch } from '../api-fetch'
import type { Endpoint } from '../types/endpoint'
import {
    ChatSchema,
    ChatMessageSchema,
    type Chat,
    type ChatMessage,
    CreateChatBodySchema,
    UpdateChatBodySchema,
    ChatResponseSchema,
    ChatListResponseSchema,
    MessageListResponseSchema,
    AiChatStreamRequestSchema,
    ForkChatBodySchema,
    ForkChatFromMessageBodySchema,
} from '../../../@octoprompt/schemas'
import { OperationSuccessResponseSchema, MessageRoleEnum } from '../../../@octoprompt/schemas'
import type { APIProviders } from '../../../@octoprompt/schemas'
import { TEST_API_URL } from './test-config'

const BASE_URL = TEST_API_URL
const API_URL = `${BASE_URL}/api`

// Generic success response schema for data not covered by specific chat schemas
const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.object({
        success: z.literal(true),
        data: dataSchema
    })


describe('Chat API Tests', () => {
    let testChats: Chat[] = []
    let testMessages: ChatMessage[] = [] // Store messages created during tests

    beforeAll(() => {
        console.log('Starting Chat API Tests...')
    })

    afterAll(async () => {
        console.log('Cleaning up chat test data...')
        for (const chat of testChats) {
            try {
                const deleteChatEndpoint: Endpoint<never, any> = {
                    url: `${API_URL}/chats/${chat.id}`,
                    options: { method: 'DELETE' }
                }
                await apiFetch(deleteChatEndpoint, undefined, OperationSuccessResponseSchema)
            } catch (err) {
                // Log error but continue cleanup
                console.error(`Failed to delete chat ${chat.id}:`, err)
            }
        }
    })

    test('POST /api/chats - Create chats', async () => {
        const chatData = [
            { title: 'Test Chat 1' },
            { title: 'Test Chat 2', copyExisting: false }, // Example with optional param
            { title: 'Test Chat 3' }
        ]

        const createChatEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/chats`,
            options: { method: 'POST' }
        }

        for (const data of chatData) {
            const result = await apiFetch(createChatEndpoint, data, ChatResponseSchema)

            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            expect(result.data.id).toBeTypeOf('number')
            expect(result.data.title).toBe(data.title)
            expect(result.data.created).toBeTypeOf('number')
            expect(result.data.updated).toBeTypeOf('number')
            testChats.push(result.data)
        }
        expect(testChats.length).toBe(chatData.length)
    })

    test('GET /api/chats - List all chats and verify creations', async () => {
        const listChatsEndpoint: Endpoint<never, any> = { url: `${API_URL}/chats` }
        const result = await apiFetch(listChatsEndpoint, undefined, ChatListResponseSchema)

        expect(result.success).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)
        expect(result.data.length).toBeGreaterThanOrEqual(testChats.length)

        for (const testChat of testChats) {
            const found = result.data.find((c: Chat) => c.id === testChat.id)
            expect(found).toBeDefined()
            expect(found?.title).toBe(testChat.title)
        }
    })

    test('PATCH /api/chats/{chatId} - Update chat title', async () => {
        if (testChats.length === 0) {
            console.warn('Skipping PATCH /api/chats test as no chats were created.')
            return
        }
        const chatToUpdate = testChats[0]
        if (!chatToUpdate) {
            console.warn('Skipping PATCH /api/chats test as chatToUpdate is undefined unexpectedly.')
            return
        }
        const newTitle = 'Updated Test Chat Title'

        const updateChatEndpoint: Endpoint<any, any> = {
            url: `${API_URL}/chats/${chatToUpdate.id}`,
            options: { method: 'PATCH' }
        }

        const result = await apiFetch(updateChatEndpoint, { title: newTitle }, ChatResponseSchema)

        expect(result.success).toBe(true)
        expect(result.data.id).toBe(chatToUpdate.id)
        expect(result.data.title).toBe(newTitle)
        expect(result.data.updated).toBeGreaterThan(chatToUpdate.updated)

        // Update local copy
        const chatIndex = testChats.findIndex(c => c.id === chatToUpdate.id)
        if (chatIndex !== -1) {
            testChats[chatIndex] = result.data
        }
    })

    test('GET /api/chats - Verify update', async () => {
        const listChatsEndpoint: Endpoint<never, any> = { url: `${API_URL}/chats` }
        const result = await apiFetch(listChatsEndpoint, undefined, ChatListResponseSchema)

        expect(result.success).toBe(true)
        const updatedChat = testChats[0] // Assuming the first chat was updated
        if (!updatedChat) return // Should not happen if previous test ran

        const found = result.data.find((c: Chat) => c.id === updatedChat.id)
        expect(found).toBeDefined()
        expect(found?.title).toBe(updatedChat.title)
    })

    // Test cases will be added here

    // test('POST /api/ai/chat - Send a message to a chat (initiates stream)', async () => {
    //     if (testChats.length === 0) {
    //         console.warn('Skipping POST /api/ai/chat test as no chats exist.');
    //         return;
    //     }
    //     const targetChat = testChats[0];
    //     if (!targetChat) return;

    //     const tempId = Date.now();
    //     const messageContent = 'Hello AI, this is a test message!';

    //     const aiChatEndpoint: Endpoint<any, any> = {
    //         url: `${API_URL}/ai/chat`,
    //         options: { method: 'POST' }
    //     };

    //     // For streaming, apiFetch might not be ideal if it strictly expects JSON.
    //     // We'll use raw fetch for this and check status + headers.
    //     const response = await fetch(aiChatEndpoint.url, {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify({
    //             chatId: targetChat.id,
    //             userMessage: messageContent,
    //             tempId: tempId,
    //             options: { provider: 'ollama', model: 'llama3' } // Example provider/model
    //         } as z.infer<typeof AiChatStreamRequestSchema>)
    //     });

    //     expect(response.status).toBe(200);
    //     expect(response.headers.get('content-type')).toContain('text/event-stream');

    //     // To actually consume and verify stream content is more involved.
    //     // For now, we check if the stream was initiated.
    //     // We'll assume the first message created by this is the user's message, and an AI response will follow.
    //     // We can't easily get the AI message ID here without full stream processing.
    //     // Store a placeholder or a representation of the user message for subsequent tests.
    //     // A proper test would involve reading the stream and finding message IDs.
    //     const userMessageForTest: Partial<ChatMessage> = {
    //         chatId: targetChat.id,
    //         role: MessageRoleEnum.enum.user,
    //         content: messageContent,
    //         // id and created will be set by the backend
    //     };
    //     // We don't add to testMessages here as we don't have the full AI response or its ID yet.
    //     // Subsequent GET /messages should show it.
    // });

    // test('GET /api/chats/{chatId}/messages - Get messages and verify sent message', async () => {
    //     if (testChats.length === 0) {
    //         console.warn('Skipping GET /messages test as no chats exist.');
    //         return;
    //     }
    //     const targetChat = testChats[0];
    //     if (!targetChat) return;

    //     const getMessagesEndpoint: Endpoint<never, any> = {
    //         url: `${API_URL}/chats/${targetChat.id}/messages`,
    //     };
    //     const result = await apiFetch(getMessagesEndpoint, undefined, MessageListResponseSchema);

    //     expect(result.success).toBe(true);
    //     expect(Array.isArray(result.data)).toBe(true);
    //     // We expect at least the user message and likely an AI response.
    //     expect(result.data.length).toBeGreaterThanOrEqual(1);

    //     const sentUserMessage = result.data.find((m: ChatMessage) =>
    //         m.role === MessageRoleEnum.enum.user &&
    //         m.content.includes('Hello AI, this is a test message!')
    //     );
    //     expect(sentUserMessage).toBeDefined();
    //     if (sentUserMessage) {
    //         testMessages.push(sentUserMessage); // Add the user message with its actual ID
    //     }

    //     // Also try to find an assistant message
    //     const assistantMessage = result.data.find((m: ChatMessage) => m.role === MessageRoleEnum.enum.assistant);
    //     if (assistantMessage) {
    //         testMessages.push(assistantMessage); // Add assistant message if found
    //     }
    // });

    // test('DELETE /api/chats/{chatId}/messages/{messageId} - Delete a message', async () => {
    //     if (testMessages.length === 0) {
    //         console.warn('Skipping DELETE /message test as no messages were added.');
    //         return;
    //     }
    //     // Delete the last added message (could be user or assistant)
    //     const messageToDelete = testMessages.pop();
    //     if (!messageToDelete) return;

    //     const deleteMessageEndpoint: Endpoint<never, any> = {
    //         url: `${API_URL}/chats/${messageToDelete.chatId}/messages/${messageToDelete.id}`,
    //         options: { method: 'DELETE' }
    //     };

    //     const result = await apiFetch(deleteMessageEndpoint, undefined, OperationSuccessResponseSchema);
    //     expect(result.success).toBe(true);
    //     expect(result.message).toBe('Message deleted successfully');
    // });

    // test('GET /api/chats/{chatId}/messages - Verify message deletion', async () => {
    //     if (testChats.length === 0 || testMessages.length === 0) { // testMessages might be empty if only one was added and then deleted
    //         // If testMessages is empty, we need a chat to check against. 
    //         // This case is a bit tricky as we don't know which message ID was *meant* to be deleted if testMessages is empty.
    //         // So, this test implicitly relies on at least one message remaining if we deleted one from multiple.
    //         // Or, it relies on knowing the ID of the deleted message to ensure it's NOT present.
    //         // For simplicity, if testMessages is now empty, we'll fetch messages for the first chat
    //         // and expect one less message than before the delete, or zero if only one cycle of create/delete ran.
    //         // This isn't perfectly robust but covers the basic scenario.
    //         console.warn('Skipping message deletion verification due to complex state or no remaining messages to check against specifically.');
    //         return;
    //     }

    //     const targetChat = testChats.find(c => c.id === testMessages[0]?.chatId); // Find chat of a remaining message
    //     if (!targetChat) {
    //         console.warn('Could not find target chat for deletion verification.');
    //         return;
    //     }
    //     const deletedMessageId = testMessages.find(m => !m.id); // This logic is flawed; deleted message is removed from testMessages
    //     // We'd need to store the ID of the deleted message separately.
    //     // Let's assume we deleted the last one popped.
    //     // This test will verify that *a* message is gone, not a specific one.

    //     const getMessagesEndpoint: Endpoint<never, any> = {
    //         url: `${API_URL}/chats/${targetChat.id}/messages`,
    //     };
    //     const result = await apiFetch(getMessagesEndpoint, undefined, MessageListResponseSchema);

    //     expect(result.success).toBe(true);
    //     // The number of messages should be less than before, or if one was added and one deleted, it might be 0 or 1 (if AI responded and user msg was deleted).
    //     // This assertion needs to be more robust based on exact flow.
    //     // For now, just ensure the call succeeds. A better test would track counts or specific IDs.
    // });

    // test('POST /api/chats/{chatId}/fork - Fork a chat', async () => {
    //     if (testChats.length === 0) {
    //         console.warn('Skipping fork chat test as no chats exist.');
    //         return;
    //     }
    //     const originalChat = testChats[0];
    //     if (!originalChat) return;

    //     // Optional: Exclude a message if one exists
    //     const messagesInOriginal = await apiFetch({ url: `${API_URL}/chats/${originalChat.id}/messages` }, undefined, MessageListResponseSchema);
    //     const excludedMessageIds = messagesInOriginal.success && messagesInOriginal.data.length > 0 && messagesInOriginal.data[0] ? [messagesInOriginal.data[0].id] : [];

    //     const forkChatEndpoint: Endpoint<any, any> = {
    //         url: `${API_URL}/chats/${originalChat.id}/fork`,
    //         options: { method: 'POST' }
    //     };
    //     const body: z.infer<typeof ForkChatBodySchema> = { excludedMessageIds };

    //     const result = await apiFetch(forkChatEndpoint, body, ChatResponseSchema);

    //     expect(result.success).toBe(true);
    //     expect(result.data.id).toBeTypeOf('number');
    //     expect(result.data.id).not.toBe(originalChat.id);
    //     expect(result.data.title).toContain(originalChat.title); // Forked title might be based on original
    //     testChats.push(result.data); // Add forked chat to cleanup

    //     // Verify original chat messages are unchanged
    //     const originalMessagesAfterFork = await apiFetch({ url: `${API_URL}/chats/${originalChat.id}/messages` }, undefined, MessageListResponseSchema);
    //     expect(originalMessagesAfterFork.success).toBe(true);
    //     expect(originalMessagesAfterFork.data.length).toBe(messagesInOriginal.data.length);

    //     // Verify forked chat messages (should have messages except excluded ones)
    //     const forkedChatMessages = await apiFetch({ url: `${API_URL}/chats/${result.data.id}/messages` }, undefined, MessageListResponseSchema);
    //     expect(forkedChatMessages.success).toBe(true);
    //     if (excludedMessageIds.length > 0) {
    //         expect(forkedChatMessages.data.length).toBe(messagesInOriginal.data.length - excludedMessageIds.length);
    //         expect(forkedChatMessages.data.some(m => m.id === excludedMessageIds[0])).toBe(false);
    //     } else {
    //         expect(forkedChatMessages.data.length).toBe(messagesInOriginal.data.length);
    //     }
    // });

    // test('POST /api/chats/{chatId}/fork/{messageId} - Fork from a specific message', async () => {
    //     if (testChats.length < 1 || testMessages.length < 2) { // Need a chat and at least two messages for a meaningful fork-from-message test
    //         console.warn('Skipping fork from message test due to insufficient chats or messages.');
    //         return;
    //     }
    //     const originalChat = testChats[0]; // Use the first original chat
    //     if (!originalChat) return;

    //     // Get messages from the original chat
    //     const messagesResponse = await apiFetch({ url: `${API_URL}/chats/${originalChat.id}/messages` }, undefined, MessageListResponseSchema);
    //     if (!messagesResponse.success || messagesResponse.data.length < 2) {
    //         console.warn('Skipping fork from message: Original chat has less than 2 messages.');
    //         return;
    //     }
    //     const messageToForkFrom = messagesResponse.data[1]; // Fork from the second message (index 1)
    //     if (!messageToForkFrom) { // Explicit check
    //         console.warn('Skipping fork from message: Second message (messageToForkFrom) not found.');
    //         return;
    //     }

    //     const forkFromMsgEndpoint: Endpoint<any, any> = {
    //         url: `${API_URL}/chats/${originalChat.id}/fork/${messageToForkFrom.id}`,
    //         options: { method: 'POST' }
    //     };
    //     // Exclude a different message if desired, or none
    //     const body: z.infer<typeof ForkChatFromMessageBodySchema> = { excludedMessageIds: [] };

    //     const result = await apiFetch(forkFromMsgEndpoint, body, ChatResponseSchema);

    //     expect(result.success).toBe(true);
    //     expect(result.data.id).toBeTypeOf('number');
    //     expect(result.data.id).not.toBe(originalChat.id);
    //     testChats.push(result.data); // Add forked chat to cleanup

    //     // Verify messages in the new forked chat
    //     const newForkedMessages = await apiFetch({ url: `${API_URL}/chats/${result.data.id}/messages` }, undefined, MessageListResponseSchema);
    //     expect(newForkedMessages.success).toBe(true);
    //     // Should contain messages up to and including the messageToForkFrom, minus any explicitly excluded AFTER fork point (not implemented here)
    //     const forkPointIndex = messagesResponse.data.findIndex(m => m.id === messageToForkFrom.id);
    //     if (forkPointIndex === -1) { // messageToForkFrom should exist in messagesResponse.data
    //         console.warn('Fork point message not found in original messages list, cannot verify forked content accurately.');
    //         return;
    //     }
    //     const originalMessagesUpToForkPoint = messagesResponse.data.slice(0, forkPointIndex + 1);
    //     expect(newForkedMessages.data.length).toBe(originalMessagesUpToForkPoint.length);
    //     // Check if all expected messages are present
    //     for (const origMsg of originalMessagesUpToForkPoint) {
    //         expect(newForkedMessages.data.some(fm => fm.content === origMsg.content && fm.role === origMsg.role)).toBe(true);
    //     }
    // });

    // test('DELETE /api/chats/{chatId} - Delete a chat session', async () => {
    //     if (testChats.length === 0) {
    //         console.warn('Skipping DELETE /chat test as no chats exist to delete explicitly.');
    //         return;
    //     }
    //     // Take the last chat added (could be a forked one) for this specific delete test
    //     const chatToDelete = testChats.pop();
    //     if (!chatToDelete) return;

    //     const deleteChatEndpoint: Endpoint<never, any> = {
    //         url: `${API_URL}/chats/${chatToDelete.id}`,
    //         options: { method: 'DELETE' }
    //     };
    //     const result = await apiFetch(deleteChatEndpoint, undefined, OperationSuccessResponseSchema);

    //     expect(result.success).toBe(true);
    //     expect(result.message).toBe('Chat deleted successfully');

    //     // Verify it's gone by trying to fetch it (expect 404)
    //     const getChatEndpoint: Endpoint<never, any> = { url: `${API_URL}/chats/${chatToDelete.id}` };
    //     try {
    //         await apiFetch(getChatEndpoint, undefined, ChatResponseSchema);
    //         // If it doesn't throw, it means the chat was not deleted, which is a failure
    //         expect(true).toBe(false); // Force failure
    //     } catch (error: any) {
    //         // We expect an error. A more robust check would be to ensure it's a 404.
    //         // apiFetch throws on non-ok status, so an error is expected.
    //         // For now, catching any error implies the fetch failed, which is good.
    //         // Bun test doesn't have a simple expect(fn).toThrow() for async that works with apiFetch easily.
    //         expect(error).toBeDefined();
    //     }
    // });
})
