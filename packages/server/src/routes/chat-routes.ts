import { ProviderChatService } from '@/services/model-providers/chat/provider-chat-service';
import { UnifiedProviderService } from '@/services/model-providers/providers/unified-provider-service';
import { json } from '@bnk/router';
import { router } from "server-router";

import { chatApiValidation } from 'shared/src/validation/chat-api-validation';


/** 
 * Create a single ChatAIService instance that orchestrates 
 * both ChatService (for chats/messages) and ProviderService (for LLM calls). 
 */
const chatAIService = new ProviderChatService();
const unifiedProviderService = new UnifiedProviderService();

const AI_BASE_PATH = '/api/ai';


// ---------------------------------------- //
//         MAIN CHAT ROUTES
// ---------------------------------------- //

// Unified chat endpoint (supports all providers, including gemini)
router.post(`${AI_BASE_PATH}/chat`, {
    validation: chatApiValidation.create,
}, async (req, { body }) => {
    try {
        /** 
         * All logic is now in ChatAIService.processMessage()
         * which orchestrates ChatService + ProviderService 
         */
        const stream = await chatAIService.processMessage(
            {
                chatId: body.chatId,
                userMessage: body.message,
                provider: body.provider,
                // TODO: validation options before passing to make sure it's a valid object for the provider
                options: { ...body.options, debug: true } as any,
                tempId: body.tempId,
            }
            // {
            //     chatId: body.chatId,

            // }
            // body.chatId,
            // body.message,
            // body.provider,
            // body.options,
            // body.tempId
        );

        const headers = {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Provider': body.provider
        };

        return new Response(stream as any, { headers });
    } catch (error) {
        console.error('Chat processing error:', error);
        return json.error(error instanceof Error ? error.message : 'Unknown error occurred', 500);
    }
});

router.post(`${AI_BASE_PATH}/chats`, {
    validation: chatApiValidation.createChat,
}, async (req, { body }) => {
    try {
        /** Create a new chat via the internal ChatService in ChatAIService */
        const chat = await chatAIService.chat.createChat(body.title);
        return json({ data: chat });
    } catch (error) {
        console.error('Error creating chat:', error);
        return json.error('Failed to create chat', 500);
    }
});

router.get(`${AI_BASE_PATH}/chats`, {}, async () => {
    try {
        const userChats = await chatAIService.chat.getAllChats();
        return json({ data: userChats });
    } catch (error) {
        console.error('Error getting chats:', error);
        return json.error('Failed to get chats', 500);
    }
});

router.get(`${AI_BASE_PATH}/chats/:chatId/messages`, {
    validation: chatApiValidation.getMessages,
}, async (req, { params }) => {
    try {
        const messages = await chatAIService.chat.getChatMessages(params.chatId);
        return json({ data: messages });
    } catch (error) {
        console.error('Error getting messages:', error);
        return json.error('Failed to get messages', 500);
    }
});

// Fork entire chat with exclusions
router.post(`${AI_BASE_PATH}/chats/:chatId/fork`, {
    validation: chatApiValidation.forkChat,
}, async (req, { params, body }) => {
    try {
        const newChat = await chatAIService.chat.forkChat(params.chatId, body.excludedMessageIds);
        return json({ data: newChat });
    } catch (error) {
        console.error('Error forking chat:', error);
        return json.error('Failed to fork chat', 500);
    }
});

// Fork chat from a specific message with exclusions
router.post(`${AI_BASE_PATH}/chats/:chatId/fork/:messageId`, {
    validation: chatApiValidation.forkChatFromMessage,
}, async (req, { params, body }) => {
    try {
        const newChat = await chatAIService.chat.forkChatFromMessage(
            params.chatId,
            params.messageId,
            body.excludedMessageIds
        );
        return json({ data: newChat });
    } catch (error) {
        console.error('Error forking chat from message:', error);
        return json.error('Failed to fork chat from message', 500);
    }
});

// Update chat
router.patch(`${AI_BASE_PATH}/chats/:chatId`, {
    validation: chatApiValidation.updateChat,
}, async (req, { params, body }) => {
    try {
        const updatedChat = await chatAIService.chat.updateChat(params.chatId, body.title);
        return json({ data: updatedChat });
    } catch (error) {
        console.error('Error updating chat:', error);
        return json.error('Failed to update chat', 500);
    }
});

// Delete chat
router.delete(`${AI_BASE_PATH}/chats/:chatId`, {
    validation: chatApiValidation.deleteChat,
}, async (req, { params }) => {
    try {
        await chatAIService.chat.deleteChat(params.chatId);
        return json({ success: true });
    } catch (error) {
        console.error('Error deleting chat:', error);
        return json.error('Failed to delete chat', 500);
    }
});

// Delete message
router.delete(`${AI_BASE_PATH}/messages/:messageId`, {
    validation: chatApiValidation.deleteMessage,
}, async (req, { params }) => {
    try {
        await chatAIService.chat.deleteMessage(params.messageId);
        return json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        return json.error('Failed to delete message', 500);
    }
});

router.get('/api/models', {}, async (req) => {
    try {
        // Read provider from query param: ?provider=openrouter
        const url = new URL(req.url);
        const provider = url.searchParams.get('provider');

        // Basic check
        if (!provider) {
            return json.error('Provider is required', 400);
        }

        // Use the unified listModels method
        const data = await unifiedProviderService.listModels(provider as any);
        return json({ data });
    } catch (error) {
        console.error('Error listing models:', error);
        return json.error(error instanceof Error ? error.message : 'Unknown error', 500);
    }
});