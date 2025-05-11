import { db } from "@/utils/database";
import { normalizeToIsoString } from "@/utils/parse-timestamp";
import { ChatSchema, ChatMessageSchema, ChatMessage, Chat, ExtendedChatMessage } from "shared/src/schemas/chat.schemas";
import { randomUUID } from "crypto";
import { ApiError } from 'shared'; 

export type CreateChatOptions = {
    copyExisting?: boolean;
    currentChatId?: string;
};

type RawChat = {
    id: string;
    title: string;
    created_at: number;
    updated_at: number;
};

type RawChatMessage = {
    id: string;
    chat_id: string;
    role: string;
    content: string;
    created_at: number;
};

// Helper function to map DB row to Chat schema
function mapDbRowToChat(row: RawChat): Chat { // Expects a valid RawChat object
    const mapped = {
        id: row.id,
        title: row.title,
        createdAt: normalizeToIsoString(row.created_at),
        updatedAt: normalizeToIsoString(row.updated_at)
    };

    if (mapped.createdAt === null || mapped.updatedAt === null) {
        console.error('Failed to normalize date for chat:', row);
        throw new ApiError(500, `Data integrity issue: Failed to parse date for chat ${row.id}.`, 'CHAT_DATE_CORRUPT', { id: row.id, createdAtRaw: row.created_at, updatedAtRaw: row.updated_at });
    }

    const result = ChatSchema.safeParse(mapped);
    if (!result.success) {
        console.error(`Failed to parse chat data for ID ${row.id}: ${result.error.message}`, { raw: row, mapped, errors: result.error.flatten().fieldErrors });
        throw new ApiError(500, `Data integrity issue: Failed to parse chat data for ID ${row.id}.`, 'CHAT_DATA_CORRUPT', result.error.flatten().fieldErrors);
    }
    return result.data;
}

// Helper function to map DB row to ChatMessage schema
function mapDbRowToChatMessage(row: RawChatMessage): ChatMessage { // Expects a valid RawChatMessage object
    const mapped = {
        id: row.id,
        chatId: row.chat_id,
        role: row.role,
        content: row.content,
        createdAt: normalizeToIsoString(row.created_at)
    };

    if (mapped.createdAt === null) {
        console.error('Failed to normalize date for chat message:', row);
        throw new ApiError(500, `Data integrity issue: Failed to parse date for message ${row.id}.`, 'MESSAGE_DATE_CORRUPT', { id: row.id, createdAtRaw: row.created_at });
    }

    const result = ChatMessageSchema.safeParse(mapped);
    if (!result.success) {
        console.error(`Failed to parse chat message data for ID ${row.id}: ${result.error.message}`, { raw: row, mapped, errors: result.error.flatten().fieldErrors });
        throw new ApiError(500, `Data integrity issue: Failed to parse chat message data for ID ${row.id}.`, 'MESSAGE_DATA_CORRUPT', result.error.flatten().fieldErrors);
    }
    return result.data;
}

/**
 * Returns an object of functions handling chat logic in a functional style.
 */
export function createChatService() {
    async function createChat(title: string, options?: CreateChatOptions): Promise<Chat> {
        if (options?.copyExisting && options?.currentChatId) {
            const sourceChatExists = db.prepare('SELECT id FROM chats WHERE id = ?').get(options.currentChatId) as { id: string } | undefined;
            if (!sourceChatExists) {
                throw new ApiError(404, `Referenced chat with ID ${options.currentChatId} not found for copying.`, 'REFERENCED_CHAT_NOT_FOUND');
            }
        }

        const chatId = randomUUID();
        const stmt = db.prepare(`
            INSERT INTO chats (id, title) 
            VALUES (?, ?)
            RETURNING *
        `);
        const rawChat = stmt.get(chatId, title) as RawChat | undefined;

        if (!rawChat) {
            throw new ApiError(500, "Failed to create chat: database did not return chat data.", 'CHAT_CREATION_FAILED');
        }
        const chat = mapDbRowToChat(rawChat); // mapDbRowToChat now throws on parsing error

        if (options?.copyExisting && options?.currentChatId) {
            const sourceStmt = db.prepare(`
                SELECT * FROM chat_messages 
                WHERE chat_id = ? 
                ORDER BY created_at
            `);
            const sourceMessages = sourceStmt.all(options.currentChatId) as RawChatMessage[];

            if (sourceMessages.length > 0) {
                const insertStmt = db.prepare(`
                    INSERT INTO chat_messages (id, chat_id, role, content)
                    VALUES (?, ?, ?, ?)
                `);
                // Consider batch insert if supported and beneficial for performance
                for (const msg of sourceMessages) {
                    insertStmt.run(randomUUID(), chat.id, msg.role, msg.content);
                }
            }
        }
        return chat;
    }

    async function updateChatTimestamp(chatId: string): Promise<void> {
        const stmt = db.prepare(`
            UPDATE chats 
            SET updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);
        const info = stmt.run(chatId);
        if (info.changes === 0) {
            throw new ApiError(404, `Chat with ID ${chatId} not found for timestamp update.`, 'CHAT_NOT_FOUND');
        }
    }

    async function saveMessage(message: ExtendedChatMessage): Promise<ExtendedChatMessage> {
        const chatExists = db.prepare('SELECT id FROM chats WHERE id = ?').get(message.chatId) as { id: string } | undefined;
        if (!chatExists) {
            throw new ApiError(404, `Chat with ID ${message.chatId} not found. Cannot save message.`, 'CHAT_NOT_FOUND_FOR_MESSAGE');
        }

        const messageId = message.id || randomUUID(); // Use provided ID or generate new
        const stmt = db.prepare(`
            INSERT INTO chat_messages (id, chat_id, role, content)
            VALUES (?, ?, ?, ?)
            RETURNING *
        `);
        // Ensure timestamp is handled if new message vs updating existing
        const rawSaved = stmt.get(messageId, message.chatId, message.role, message.content) as RawChatMessage | undefined;

        if (!rawSaved) {
            throw new ApiError(500, "Failed to save chat message: database did not return message data.", 'MESSAGE_SAVE_FAILED');
        }
        const saved = mapDbRowToChatMessage(rawSaved);
        return { ...saved, tempId: message.tempId };
    }

    async function updateMessageContent(messageId: string, content: string): Promise<void> {
        const stmt = db.prepare(`
            UPDATE chat_messages 
            SET content = ? 
            WHERE id = ?
        `);
        const info = stmt.run(content, messageId);
        if (info.changes === 0) {
            throw new ApiError(404, `Message with ID ${messageId} not found for update.`, 'MESSAGE_NOT_FOUND');
        }
    }

    async function getAllChats(): Promise<Chat[]> {
        const stmt = db.prepare(`
            SELECT * FROM chats 
            ORDER BY updated_at DESC 
        `); // Often more useful to have newest first
        const rows = stmt.all() as RawChat[];
        return rows.map(mapDbRowToChat); // mapDbRowToChat throws if an individual chat parsing fails
    }

    async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
        const chatExists = db.prepare('SELECT id FROM chats WHERE id = ?').get(chatId) as { id: string } | undefined;
        if (!chatExists) {
            throw new ApiError(404, `Chat with ID ${chatId} not found.`, 'CHAT_NOT_FOUND');
        }

        const stmt = db.prepare(`
            SELECT * FROM chat_messages 
            WHERE chat_id = ? 
            ORDER BY created_at
        `);
        const messages = stmt.all(chatId) as RawChatMessage[];
        return messages.map(mapDbRowToChatMessage); // mapDbRowToChatMessage throws on parsing error
    }

    async function updateChat(chatId: string, title: string): Promise<Chat> {
        const stmt = db.prepare(`
            UPDATE chats 
            SET title = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            RETURNING *
        `);
        const rawUpdated = stmt.get(title, chatId) as RawChat | undefined;
        if (!rawUpdated) {
            throw new ApiError(404, `Chat with ID ${chatId} not found for update.`, 'CHAT_NOT_FOUND');
        }
        return mapDbRowToChat(rawUpdated);
    }

    async function deleteChat(chatId: string): Promise<void> {
        // It's good practice to ensure the chat exists before attempting deletion,
        // or rely on the DB to report 0 changes if it doesn't.
        const deleteMessagesStmt = db.prepare(`
            DELETE FROM chat_messages 
            WHERE chat_id = ?
        `);
        deleteMessagesStmt.run(chatId); // Deletes related messages, might affect 0 rows if no messages

        const deleteChatStmt = db.prepare(`
            DELETE FROM chats 
            WHERE id = ?
        `);
        const info = deleteChatStmt.run(chatId);
        if (info.changes === 0) {
            throw new ApiError(404, `Chat with ID ${chatId} not found for deletion.`, 'CHAT_NOT_FOUND');
        }
    }

    async function deleteMessage(messageId: string): Promise<void> {
        const stmt = db.prepare(`
            DELETE FROM chat_messages 
            WHERE id = ?
        `);
        const info = stmt.run(messageId);
        if (info.changes === 0) {
            throw new ApiError(404, `Message with ID ${messageId} not found for deletion.`, 'MESSAGE_NOT_FOUND');
        }
    }

    async function forkChat(sourceChatId: string, excludedMessageIds: string[] = []): Promise<Chat> {
        const sourceChatStmt = db.prepare(`SELECT * FROM chats WHERE id = ?`);
        const rawSourceChat = sourceChatStmt.get(sourceChatId) as RawChat | undefined;
        if (!rawSourceChat) {
            throw new ApiError(404, `Source chat with ID ${sourceChatId} not found for forking.`, 'SOURCE_CHAT_NOT_FOUND');
        }
        const sourceChat = mapDbRowToChat(rawSourceChat); // Ensure source chat data is valid

        const newTitle = `Fork of ${sourceChat.title} (${new Date().toLocaleTimeString()})`; // Or a more robust title
        const newChatId = randomUUID();
        const createStmt = db.prepare(`
            INSERT INTO chats (id, title)
            VALUES (?, ?)
            RETURNING *
        `);
        const rawNewChat = createStmt.get(newChatId, newTitle) as RawChat | undefined;
        if (!rawNewChat) {
            throw new ApiError(500, "Failed to create forked chat: database did not return new chat data.", 'CHAT_FORK_CREATION_FAILED');
        }
        const newChat = mapDbRowToChat(rawNewChat);

        const sourceMessagesStmt = db.prepare(`
            SELECT * FROM chat_messages 
            WHERE chat_id = ? 
            ORDER BY created_at
        `);
        const sourceMessages = sourceMessagesStmt.all(sourceChatId) as RawChatMessage[];
        const messagesToCopy = sourceMessages.filter(m => !excludedMessageIds.includes(m.id));

        if (messagesToCopy.length > 0) {
            const insertMsgStmt = db.prepare(`
                INSERT INTO chat_messages (id, chat_id, role, content, created_at) 
                VALUES (?, ?, ?, ?, ?) 
            `); // Copy created_at to maintain order if desired, or use current time
            // Note: SQLite's CURRENT_TIMESTAMP gives seconds. JS new Date().getTime() is millis.
            // Be careful if you copy created_at directly from different sources or want new timestamps.
            // For simplicity, let's assume we copy the original content including its original creation time if relevant for ordering.
            // Or better, let DB handle new created_at for new messages.
            const insertMessageTx = db.transaction((msgs: RawChatMessage[]) => {
                for (const msg of msgs) {
                    insertMsgStmt.run(randomUUID(), newChat.id, msg.role, msg.content, msg.created_at);
                }
            });
            insertMessageTx(messagesToCopy);
        }
        return newChat;
    }

    async function forkChatFromMessage(
        sourceChatId: string,
        messageId: string,
        excludedMessageIds: string[] = []
    ): Promise<Chat> {
        const sourceChatStmt = db.prepare(`SELECT * FROM chats WHERE id = ?`);
        const rawSourceChat = sourceChatStmt.get(sourceChatId) as RawChat | undefined;
        if (!rawSourceChat) {
            throw new ApiError(404, `Source chat with ID ${sourceChatId} not found.`, 'SOURCE_CHAT_NOT_FOUND');
        }
        const sourceChat = mapDbRowToChat(rawSourceChat);


        const startMessageStmt = db.prepare(`SELECT * FROM chat_messages WHERE id = ?`);
        const rawStartMessage = startMessageStmt.get(messageId) as RawChatMessage | undefined;
        if (!rawStartMessage) {
            throw new ApiError(404, `Starting message with ID ${messageId} not found.`, 'MESSAGE_NOT_FOUND');
        }
        if (rawStartMessage.chat_id !== sourceChatId) {
            throw new ApiError(400, `Message ${messageId} does not belong to the specified chat ${sourceChatId}.`, 'MESSAGE_CHAT_MISMATCH');
        }

        const newTitle = `Fork from ${sourceChat.title} at message (${messageId.substring(0, 8)})`;
        const newChatId = randomUUID();
        const createStmt = db.prepare(`
            INSERT INTO chats (id, title)
            VALUES (?, ?)
            RETURNING *
        `);
        const rawNewChat = createStmt.get(newChatId, newTitle) as RawChat | undefined;
        if (!rawNewChat) {
            throw new ApiError(500, "Failed to create forked chat from message: database did not return new chat data.", 'CHAT_FORK_MESSAGE_CREATION_FAILED');
        }
        const newChat = mapDbRowToChat(rawNewChat);

        const sourceMessagesStmt = db.prepare(`
            SELECT * FROM chat_messages 
            WHERE chat_id = ? 
            ORDER BY created_at
        `);
        const sourceMessages = sourceMessagesStmt.all(sourceChatId) as RawChatMessage[];
        const indexOfStart = sourceMessages.findIndex(m => m.id === messageId);

        if (indexOfStart === -1) {
            // This should ideally not happen if startMessage was found and belongs to chat
            throw new ApiError(500, `Internal error: Could not re-find the starting message ${messageId} in chat sequence.`, 'MESSAGE_SEQUENCE_ERROR');
        }

        const messagesToCopy = sourceMessages.slice(0, indexOfStart + 1)
            .filter(m => !excludedMessageIds.includes(m.id));

        if (messagesToCopy.length > 0) {
            const insertMsgStmt = db.prepare(`
                INSERT INTO chat_messages (id, chat_id, role, content, created_at)
                VALUES (?, ?, ?, ?, ?)
            `);
            const insertMessageTx = db.transaction((msgs: RawChatMessage[]) => {
                for (const msg of msgs) {
                    insertMsgStmt.run(randomUUID(), newChat.id, msg.role, msg.content, msg.created_at);
                }
            });
            insertMessageTx(messagesToCopy);
        }
        return newChat;
    }

    return {
        createChat,
        updateChatTimestamp,
        saveMessage,
        updateMessageContent,
        getAllChats,
        getChatMessages,
        updateChat,
        deleteChat,
        deleteMessage,
        forkChat,
        forkChatFromMessage,
    };
}

export const chatService = createChatService();