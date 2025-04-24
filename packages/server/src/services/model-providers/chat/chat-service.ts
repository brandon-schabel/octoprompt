import { db } from "@/utils/database";
import { ChatSchema, ChatMessageSchema, ChatMessage, Chat, ExtendedChatMessage } from "shared/src/schemas/chat.schemas";
import { randomUUID } from "crypto";

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



/**
 * Returns an object of functions handling chat logic in a functional style.
 */
export function createChatService() {
    async function createChat(title: string, options?: CreateChatOptions): Promise<Chat> {
        const chatId = randomUUID();
        const stmt = db.prepare(`
            INSERT INTO chats (id, title) 
            VALUES (?, ?)
            RETURNING *
        `);
        const chat = stmt.get(chatId, title) as Chat;

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
        stmt.run(chatId);
    }

    async function saveMessage(message: ExtendedChatMessage): Promise<ExtendedChatMessage> {
        const stmt = db.prepare(`
            INSERT INTO chat_messages (id, chat_id, role, content)
            VALUES (?, ?, ?, ?)
            RETURNING *
        `);
        const saved = stmt.get(randomUUID(), message.chatId, message.role, message.content) as ChatMessage;
        return { ...saved, tempId: message.tempId };
    }

    async function updateMessageContent(messageId: string, content: string): Promise<void> {
        const stmt = db.prepare(`
            UPDATE chat_messages 
            SET content = ? 
            WHERE id = ?
        `);
        stmt.run(content, messageId);
    }

    async function getAllChats(): Promise<Chat[]> {
        const stmt = db.prepare(`
            SELECT * FROM chats 
            ORDER BY updated_at
        `);
        const rows = stmt.all() as Chat[];
        return rows;
    }

    async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
        const stmt = db.prepare(`
            SELECT * FROM chat_messages 
            WHERE chat_id = ? 
            ORDER BY created_at
        `);
        const messages = stmt.all(chatId) as ChatMessage[];
        return messages;
    }

    async function updateChat(chatId: string, title: string): Promise<Chat> {
        const stmt = db.prepare(`
            UPDATE chats 
            SET title = ? 
            WHERE id = ?
            RETURNING *
        `);
        const updated = stmt.get(title, chatId) as Chat;
        if (!updated) {
            throw new Error("Chat not found");
        }
        return updated;
    }

    async function deleteChat(chatId: string): Promise<void> {
        const deleteMessagesStmt = db.prepare(`
            DELETE FROM chat_messages 
            WHERE chat_id = ?
        `);
        deleteMessagesStmt.run(chatId);

        const deleteChatStmt = db.prepare(`
            DELETE FROM chats 
            WHERE id = ?
            RETURNING *
        `);
        const result = deleteChatStmt.get(chatId) as Chat | undefined;
        if (!result) {
            throw new Error("Chat not found");
        }
    }

    async function deleteMessage(messageId: string): Promise<void> {
        const stmt = db.prepare(`
            DELETE FROM chat_messages 
            WHERE id = ?
            RETURNING *
        `);
        const result = stmt.get(messageId) as RawChatMessage | undefined;
        if (!result) {
            throw new Error("Message not found");
        }
    }

    async function forkChat(sourceChatId: string, excludedMessageIds: string[] = []): Promise<Chat> {
        const sourceChatStmt = db.prepare(`
            SELECT * FROM chats 
            WHERE id = ?
        `);
        const sourceChat = sourceChatStmt.get(sourceChatId) as RawChat;
        if (!sourceChat) {
            throw new Error("Source chat not found");
        }

        const newTitle = `Fork of ${sourceChat.title} (${new Date().toLocaleTimeString()})`;
        const createStmt = db.prepare(`
            INSERT INTO chats (title)
            VALUES (?)
            RETURNING *
        `);
        const newChat = createStmt.get(newTitle) as Chat;

        const sourceMessagesStmt = db.prepare(`
            SELECT * FROM chat_messages 
            WHERE chat_id = ? 
            ORDER BY created_at
        `);
        const sourceMessages = sourceMessagesStmt.all(sourceChatId) as RawChatMessage[];
        const messagesToCopy = sourceMessages.filter(m => !excludedMessageIds.includes(m.id));

        if (messagesToCopy.length > 0) {
            const insertStmt = db.prepare(`
                INSERT INTO chat_messages (id, chat_id, role, content)
                VALUES (?, ?, ?, ?)
            `);
            for (const msg of messagesToCopy) {
                insertStmt.run(randomUUID(), newChat.id, msg.role, msg.content);
            }
        }

        return newChat;
    }

    async function forkChatFromMessage(
        sourceChatId: string,
        messageId: string,
        excludedMessageIds: string[] = []
    ): Promise<Chat> {
        const sourceChatStmt = db.prepare(`
            SELECT * FROM chats 
            WHERE id = ?
        `);
        const sourceChat = sourceChatStmt.get(sourceChatId) as RawChat;
        if (!sourceChat) {
            throw new Error("Source chat not found");
        }

        const startMessageStmt = db.prepare(`
            SELECT * FROM chat_messages 
            WHERE id = ?
        `);
        const startMessage = startMessageStmt.get(messageId) as RawChatMessage;
        if (!startMessage) {
            throw new Error("Starting message not found");
        }

        if (startMessage.chat_id !== sourceChatId) {
            throw new Error("Message does not belong to the specified chat");
        }

        const newTitle = `Fork from ${sourceChat.title} at ${new Date().toLocaleTimeString()}`;
        const createStmt = db.prepare(`
            INSERT INTO chats (title)
            VALUES (?)
            RETURNING *
        `);
        const newChat = createStmt.get(newTitle) as Chat;

        const sourceMessagesStmt = db.prepare(`
            SELECT * FROM chat_messages 
            WHERE chat_id = ? 
            ORDER BY created_at
        `);
        const sourceMessages = sourceMessagesStmt.all(sourceChatId) as RawChatMessage[];
        const indexOfStart = sourceMessages.findIndex(m => m.id === messageId);
        if (indexOfStart === -1) {
            throw new Error("Could not find the starting message in the chat sequence");
        }

        let messagesToCopy = sourceMessages.slice(0, indexOfStart + 1)
            .filter(m => !excludedMessageIds.includes(m.id));

        if (messagesToCopy.length > 0) {
            const insertStmt = db.prepare(`
                INSERT INTO chat_messages (id, chat_id, role, content)
                VALUES (?, ?, ?, ?)
            `);
            for (const msg of messagesToCopy) {
                insertStmt.run(randomUUID(), newChat.id, msg.role, msg.content);
            }
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