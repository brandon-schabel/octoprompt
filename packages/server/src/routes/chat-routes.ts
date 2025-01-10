import { UnifiedProviderService } from '@/services/model-providers/providers/unified-provider-service';
import { json } from '@bnk/router';
import { ApiError } from 'shared';
import { router } from "server-router";
import { chatApiValidation } from 'shared/src/validation/chat-api-validation';
import { ChatService } from '@/services/model-providers/chat/chat-service';

const unifiedProviderService = new UnifiedProviderService();
const chatService = new ChatService();

const AI_BASE_PATH = '/api/ai';

router.post(`${AI_BASE_PATH}/chat`, {
    validation: chatApiValidation.create,
}, async (_, { body }) => {
    const stream = await unifiedProviderService.processMessage({
        chatId: body.chatId,
        userMessage: body.message,
        provider: body.provider,
        options: body.options as any,
        tempId: body.tempId,
    });

    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Provider': body.provider
    };

    return new Response(stream as any, { headers });
});

router.post(`${AI_BASE_PATH}/chats`, {
    validation: chatApiValidation.createChat,
}, async (_, { body }) => {
    const chat = await chatService.createChat(body.title);
    return json({ data: chat });
});

router.get(`${AI_BASE_PATH}/chats`, {}, async () => {
    const userChats = await chatService.getAllChats();
    return json({ data: userChats });
});

router.get(`${AI_BASE_PATH}/chats/:chatId/messages`, {
    validation: chatApiValidation.getMessages,
}, async (_, { params }) => {
    const messages = await chatService.getChatMessages(params.chatId);
    return json({ data: messages });
});

router.post(`${AI_BASE_PATH}/chats/:chatId/fork`, {
    validation: chatApiValidation.forkChat,
}, async (_, { params, body }) => {
    const newChat = await chatService.forkChat(params.chatId, body.excludedMessageIds);
    return json({ data: newChat });
});

router.post(`${AI_BASE_PATH}/chats/:chatId/fork/:messageId`, {
    validation: chatApiValidation.forkChatFromMessage,
}, async (_, { params, body }) => {
    const newChat = await chatService.forkChatFromMessage(
        params.chatId,
        params.messageId,
        body.excludedMessageIds
    );
    return json({ data: newChat });
});

router.patch(`${AI_BASE_PATH}/chats/:chatId`, {
    validation: chatApiValidation.updateChat,
}, async (_, { params, body }) => {
    const updatedChat = await chatService.updateChat(params.chatId, body.title);
    return json({ data: updatedChat });
});

router.delete(`${AI_BASE_PATH}/chats/:chatId`, {
    validation: chatApiValidation.deleteChat,
}, async (_, { params }) => {
    await chatService.deleteChat(params.chatId);
    return json({ success: true });
});

router.delete(`${AI_BASE_PATH}/messages/:messageId`, {
    validation: chatApiValidation.deleteMessage,
}, async (_, { params }) => {
    await chatService.deleteMessage(params.messageId);
    return json({ success: true });
});

router.get('/api/models', {}, async (req) => {
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');
    if (!provider) {
        throw new ApiError("Provider is required", 400, "BAD_REQUEST");
    }

    const data = await unifiedProviderService.listModels(provider as any);
    return json({ data });
});