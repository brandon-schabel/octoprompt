import { zValidator } from '@hono/zod-validator';
import { chatApiValidation } from 'shared/src/validation/chat-api-validation';
import { chatService } from '@/services/model-providers/chat/chat-service';
import { unifiedProvider } from '@/services/model-providers/providers/unified-provider-service';
import { ApiError } from 'shared';
import { APIProviders, apiProviders } from 'shared';
import { z } from 'zod';
import app from '@/server-router';

// Helper function to handle errors with appropriate status codes
function handleError(error: unknown) {
    console.error('API Error:', error);

    // Handle ApiError instances with their specific status codes
    if (error instanceof ApiError) {
        return {
            success: false,
            error: error.message,
            code: error.code
        };
    }

    // Handle "not found" errors
    if (error instanceof Error &&
        (error.message.includes('not found') ||
            error.message.toLowerCase().includes('cannot find') ||
            error.message.toLowerCase().includes('does not exist'))) {
        return {
            success: false,
            error: error.message,
            code: 'NOT_FOUND'
        };
    }

    // Default error response
    return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        code: 'INTERNAL_ERROR'
    };
}

// Process a chat message (streaming)
app.post('/api/chat',
    zValidator('json', chatApiValidation.create.body),
    async (c) => {
        try {
            const body = await c.req.valid('json');

            const stream = await unifiedProvider.processMessage({
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

            return c.body(stream, { headers });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Create a new chat
app.post('/api/chats',
    zValidator('json', chatApiValidation.createChat.body),
    async (c) => {
        try {
            const body = await c.req.valid('json');
            const chat = await chatService.createChat(body.title, {
                copyExisting: body.copyExisting,
                currentChatId: body.currentChatId
            });
            return c.json({ data: chat });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Get all chats
app.get('/api/chats', async (c) => {
    try {
        const userChats = await chatService.getAllChats();
        return c.json({ data: userChats });
    } catch (error) {
        const errorResponse = handleError(error);
        return c.json(errorResponse, 500 as any);
    }
});

// Get messages for a chat
app.get('/api/chats/:chatId/messages',
    zValidator('param', chatApiValidation.getMessages.params),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            const messages = await chatService.getChatMessages(chatId);
            return c.json({ data: messages });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Fork a chat
app.post('/api/chats/:chatId/fork',
    zValidator('param', chatApiValidation.forkChat.params),
    zValidator('json', chatApiValidation.forkChat.body),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            const { excludedMessageIds } = await c.req.valid('json');
            const newChat = await chatService.forkChat(chatId, excludedMessageIds);
            return c.json({ data: newChat });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Fork chat from a specific message
app.post('/api/chats/:chatId/fork/:messageId',
    zValidator('param', chatApiValidation.forkChatFromMessage.params),
    zValidator('json', chatApiValidation.forkChatFromMessage.body),
    async (c) => {
        try {
            const { chatId, messageId } = c.req.valid('param');
            const { excludedMessageIds } = await c.req.valid('json');
            const newChat = await chatService.forkChatFromMessage(
                chatId,
                messageId,
                excludedMessageIds
            );
            return c.json({ data: newChat });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Update a chat
app.patch('/api/chats/:chatId',
    zValidator('param', chatApiValidation.updateChat.params),
    zValidator('json', chatApiValidation.updateChat.body),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            const { title } = await c.req.valid('json');
            const updatedChat = await chatService.updateChat(chatId, title);
            return c.json({ data: updatedChat });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Delete a chat
app.delete('/api/chats/:chatId',
    zValidator('param', chatApiValidation.deleteChat.params),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            await chatService.deleteChat(chatId);
            return c.json({ success: true });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Delete a message
app.delete('/api/messages/:messageId',
    zValidator('param', chatApiValidation.deleteMessage.params),
    async (c) => {
        try {
            const { messageId } = c.req.valid('param');
            await chatService.deleteMessage(messageId);
            return c.json({ success: true });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'NOT_FOUND' ? 404 :
                (errorResponse.code === 'BAD_REQUEST' ? 400 : 500);
            return c.json(errorResponse, statusCode as any);
        }
    }
);

// Get models for a provider
const modelsValidator = z.object({
    provider: z.string().refine(val => apiProviders.includes(val as any), {
        message: "Invalid provider"
    })
});

app.get(
    '/api/models',
    zValidator('query', modelsValidator),
    async (c) => {
        try {
            const { provider } = c.req.valid('query');

            const data = await unifiedProvider.listModels(provider as any);
            return c.json({ data });
        } catch (error) {
            const errorResponse = handleError(error);
            const statusCode = errorResponse.code === 'BAD_REQUEST' ? 400 : 500;
            return c.json(errorResponse, statusCode as any);
        }
    }
);

export default app;
