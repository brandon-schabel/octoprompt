import app from '@/server-router';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@/utils/database';
import { createChatService } from '@/services/model-providers/chat/chat-service';
import { ApiError } from 'shared';
import { unifiedProvider } from '@/services/model-providers/providers/unified-provider-service';

// Initialize the chat service
const chatService = createChatService();

// Create a new chat
app.post('/api/chats',
    zValidator('json', z.object({
        title: z.string(),
        copyExisting: z.boolean().optional(),
        currentChatId: z.string().optional()
    })),
    async (c) => {
        try {
            const { title, copyExisting, currentChatId } = await c.req.valid('json');
            const chat = await chatService.createChat(title, {
                copyExisting,
                currentChatId
            });
            return c.json({ success: true, chat }, 201);
        } catch (error) {
            console.error('Failed to create chat:', error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    }
);

// Get all chats
app.get('/api/chats', async (c) => {
    try {
        const chats = await chatService.getAllChats();
        return c.json({ success: true, chats });
    } catch (error) {
        console.error('Failed to list chats:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

// Get chat messages by chat ID
app.get('/api/chats/:chatId/messages', 
    zValidator('param', z.object({
        chatId: z.string()
    })),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            const messages = await chatService.getChatMessages(chatId);
            return c.json({ success: true, data: messages });
        } catch (error) {
            console.error(`Failed to get messages for chat ${c.req.param('chatId')}:`, error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    }
);

// Get chat by ID
app.get('/api/chats/:chatId',
    zValidator('param', z.object({
        chatId: z.string()
    })),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            const messages = await chatService.getChatMessages(chatId);
            return c.json({ success: true, messages });
        } catch (error) {
            console.error(`Failed to get chat ${c.req.param('chatId')}:`, error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    }
);

// Update chat title
app.patch('/api/chats/:chatId',
    zValidator('param', z.object({
        chatId: z.string()
    })),
    zValidator('json', z.object({
        title: z.string()
    })),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            const { title } = await c.req.valid('json');
            const updatedChat = await chatService.updateChat(chatId, title);
            return c.json({ success: true, chat: updatedChat });
        } catch (error) {
            console.error(`Failed to update chat ${c.req.param('chatId')}:`, error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    }
);

// Delete chat
app.delete('/api/chats/:chatId',
    zValidator('param', z.object({
        chatId: z.string()
    })),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            await chatService.deleteChat(chatId);
            return c.json({ success: true });
        } catch (error) {
            console.error(`Failed to delete chat ${c.req.param('chatId')}:`, error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    }
);

// Save message
app.post('/api/chats/:chatId/messages',
    zValidator('param', z.object({
        chatId: z.string()
    })),
    zValidator('json', z.object({
        role: z.string(),
        content: z.string(),
        id: z.string().optional()
    })),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            const message = await c.req.valid('json');

            // Update chat timestamp
            await chatService.updateChatTimestamp(chatId);

            const savedMessage = await chatService.saveMessage({
                ...message,
                chatId: chatId,
                id: message.id || crypto.randomUUID(),
                createdAt: new Date()
            });

            return c.json({ success: true, message: savedMessage });
        } catch (error) {
            console.error(`Failed to save message for chat ${c.req.param('chatId')}:`, error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    }
);

// Update message content
app.patch('/api/messages/:messageId',
    zValidator('param', z.object({
        messageId: z.string()
    })),
    zValidator('json', z.object({
        content: z.string()
    })),
    async (c) => {
        try {
            const { messageId } = c.req.valid('param');
            const { content } = await c.req.valid('json');
            await chatService.updateMessageContent(messageId, content);
            return c.json({ success: true });
        } catch (error) {
            console.error(`Failed to update message ${c.req.param('messageId')}:`, error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    }
);

// Delete message
app.delete('/api/messages/:messageId',
    zValidator('param', z.object({
        messageId: z.string()
    })),
    async (c) => {
        try {
            const { messageId } = c.req.valid('param');
            await chatService.deleteMessage(messageId);
            return c.json({ success: true });
        } catch (error) {
            console.error(`Failed to delete message ${c.req.param('messageId')}:`, error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    }
);

// Fork chat
app.post('/api/chats/:chatId/fork',
    zValidator('param', z.object({
        chatId: z.string()
    })),
    zValidator('json', z.object({
        excludedMessageIds: z.array(z.string()).optional()
    })),
    async (c) => {
        try {
            const { chatId } = c.req.valid('param');
            const { excludedMessageIds = [] } = await c.req.valid('json');
            const forkedChat = await chatService.forkChat(chatId, excludedMessageIds);
            return c.json({ success: true, chat: forkedChat });
        } catch (error) {
            console.error(`Failed to fork chat ${c.req.param('chatId')}:`, error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    }
);

// Fork chat from a specific message
app.post('/api/chats/:chatId/fork-from-message/:messageId',
    zValidator('param', z.object({
        chatId: z.string(),
        messageId: z.string()
    })),
    zValidator('json', z.object({
        excludedMessageIds: z.array(z.string()).optional()
    })),
    async (c) => {
        try {
            const { chatId, messageId } = c.req.valid('param');
            const { excludedMessageIds = [] } = await c.req.valid('json');
            const forkedChat = await chatService.forkChatFromMessage(chatId, messageId, excludedMessageIds);
            return c.json({ success: true, chat: forkedChat });
        } catch (error) {
            console.error(`Failed to fork chat ${c.req.param('chatId')} from message ${c.req.param('messageId')}:`, error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    }
);

// Get available models for a provider
app.get('/api/models',
    zValidator('query', z.object({
        provider: z.string()
    })),
    async (c) => {
        try {
            const { provider } = c.req.valid('query');
            
            console.log(`[/api/models] Request for models from provider: ${provider}`);
            
            // Use the unifiedProvider to get the models for the requested provider
            const data = await unifiedProvider.listModels(provider as any);
            
            return c.json({ success: true, models: data });
        } catch (error) {
            console.error(`Failed to get models for provider:`, error);
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    }
);
