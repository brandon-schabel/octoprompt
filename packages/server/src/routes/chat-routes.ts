import app from '@/server-router';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@db';
import { createChatService } from '@/services/model-providers/chat/chat-service';

// Initialize the chat service
const chatService = createChatService();

// Debug endpoint to test JSON parsing
app.post('/api/debug-json', async (c) => {
    let bodyText = '';
    try {
        bodyText = await c.req.text();
        console.log('Received raw body:', bodyText);
        const parsed = JSON.parse(bodyText);
        console.log('Successfully parsed JSON:', parsed);
        return c.json({
            success: true,
            received: parsed
        });
    } catch (e) {
        console.error('Failed to parse JSON:', e);
        return c.json({
            error: 'JSON parse error',
            rawBody: bodyText,
            errorMessage: e instanceof Error ? e.message : String(e)
        }, 400);
    }
});

// More comprehensive debugging endpoint
app.post('/api/debug-request', async (c) => {
    try {
        // Log request method and URL
        console.log('Debug request method:', c.req.method);
        console.log('Debug request URL:', c.req.url);

        // Log headers
        const headerEntries: [string, string][] = [];
        for (const key of Object.keys(c.req.header())) {
            const value = c.req.header(key);
            if (value) headerEntries.push([key, value]);
        }
        const headers = Object.fromEntries(headerEntries);
        console.log('Debug request headers:', headers);

        // Try to read different body formats
        let bodyText = '';
        let body = null;
        let formData: { [key: string]: string } = {};

        try {
            // Try to read as text
            bodyText = await c.req.text();
            console.log('Debug request body as text:', bodyText);

            // If content type is JSON, try to parse
            const contentType = c.req.header('content-type');
            if (contentType?.includes('application/json')) {
                try {
                    body = JSON.parse(bodyText);
                    console.log('Debug request body parsed as JSON:', body);
                } catch (jsonError) {
                    console.error('Failed to parse request body as JSON:',
                        jsonError instanceof Error ? jsonError.message : String(jsonError));
                }
            }

            // Check if it might be form data
            if (contentType?.includes('application/x-www-form-urlencoded')) {
                try {
                    const params = new URLSearchParams(bodyText);
                    for (const [key, value] of params.entries()) {
                        formData[key] = value;
                    }
                    console.log('Debug request body parsed as form data:', formData);
                } catch (formError) {
                    console.error('Failed to parse request body as form data:',
                        formError instanceof Error ? formError.message : String(formError));
                }
            }
        } catch (e) {
            console.error('Error reading request body:', e);
        }

        return c.json({
            success: true,
            debugInfo: {
                method: c.req.method,
                url: c.req.url,
                headers,
                bodyText,
                parsedJson: body,
                parsedForm: formData
            }
        });
    } catch (error) {
        console.error('Error handling debug request:', error);
        return c.json({
            error: 'Request debug error',
            message: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

// Chat endpoints

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

// Environment diagnostic endpoint
app.get('/api/env-info', async (c) => {
    try {
        // Import os only when needed
        const os = require('os');

        const envInfo = {
            // Basic info about the runtime
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            env: process.env.NODE_ENV || 'unknown',

            // Bun-specific info if available
            bunVersion: typeof Bun !== 'undefined' ? Bun.version : 'not running on Bun',

            // Process memory usage
            memoryUsage: process.memoryUsage(),

            // CPU info
            cpuCount: os.cpus().length,

            // Current time
            timestamp: new Date().toISOString(),

            // Some environment variables that are safe to expose
            safeEnvVars: {
                PORT: process.env.PORT,
                HOST: process.env.HOST,
                DEV: process.env.DEV,
            }
        };

        return c.json(envInfo);
    } catch (error) {
        console.error('Error getting environment info:', error);
        return c.json({
            error: 'Server error',
            details: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});