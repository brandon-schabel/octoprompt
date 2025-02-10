import { db } from "@/utils/database";
import { schema } from "shared";
import { ChatReadSchema, ChatMessageReadSchema } from "shared/src/utils/database/db-schemas";

export type Chat = schema.Chat;
export type ChatMessage = schema.ChatMessage;
export type ExtendedChatMessage = schema.ExtendedChatMessage;
export type NewChatMessage = schema.NewChatMessage;

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

function mapChat(row: RawChat): Chat {
    const mapped = {
        id: row.id,
        title: row.title,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime()
    };
    const chat = ChatReadSchema.parse(mapped);
    return {
        ...chat,
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt)
    };
}

function mapChatMessage(row: RawChatMessage): ChatMessage {
    const mapped = {
        id: row.id,
        chatId: row.chat_id,
        role: row.role,
        content: row.content,
        createdAt: new Date(row.created_at).getTime()
    };
    const message = ChatMessageReadSchema.parse(mapped);
    return {
        ...message,
        createdAt: new Date(message.createdAt)
    };
}

/**
 * Returns an object of functions handling chat logic in a functional style.
 */
export function createChatService() {
    async function createChat(title: string, options?: CreateChatOptions): Promise<Chat> {
        const stmt = db.prepare(`
            INSERT INTO chats (title) 
            VALUES (?)
            RETURNING *
        `);
        const created = stmt.get(title) as RawChat;
        const chat = mapChat(created);

        if (options?.copyExisting && options?.currentChatId) {
            const sourceStmt = db.prepare(`
                SELECT * FROM chat_messages 
                WHERE chat_id = ? 
                ORDER BY created_at
            `);
            const sourceMessages = sourceStmt.all(options.currentChatId) as RawChatMessage[];

            if (sourceMessages.length > 0) {
                const insertStmt = db.prepare(`
                    INSERT INTO chat_messages (chat_id, role, content)
                    VALUES (?, ?, ?)
                `);
                for (const msg of sourceMessages) {
                    insertStmt.run(chat.id, msg.role, msg.content);
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

    async function saveMessage(message: NewChatMessage & { tempId?: string }): Promise<ExtendedChatMessage> {
        const stmt = db.prepare(`
            INSERT INTO chat_messages (chat_id, role, content)
            VALUES (?, ?, ?)
            RETURNING *
        `);
        const saved = stmt.get(message.chatId, message.role, message.content) as RawChatMessage;
        const mappedMessage = mapChatMessage(saved);
        return { ...mappedMessage, tempId: message.tempId };
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
        const rows = stmt.all() as RawChat[];
        return rows.map(mapChat);
    }

    async function getChatMessages(chatId: string): Promise<ExtendedChatMessage[]> {
        const stmt = db.prepare(`
            SELECT * FROM chat_messages 
            WHERE chat_id = ? 
            ORDER BY created_at
        `);
        const messages = stmt.all(chatId) as RawChatMessage[];
        return messages.map(msg => ({ ...mapChatMessage(msg) }));
    }

    async function updateChat(chatId: string, title: string): Promise<Chat> {
        const stmt = db.prepare(`
            UPDATE chats 
            SET title = ? 
            WHERE id = ?
            RETURNING *
        `);
        const updated = stmt.get(title, chatId) as RawChat;
        if (!updated) {
            throw new Error("Chat not found");
        }
        return mapChat(updated);
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
        const result = deleteChatStmt.get(chatId) as RawChat | undefined;
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
        const newChat = mapChat(createStmt.get(newTitle) as RawChat);

        const sourceMessagesStmt = db.prepare(`
            SELECT * FROM chat_messages 
            WHERE chat_id = ? 
            ORDER BY created_at
        `);
        const sourceMessages = sourceMessagesStmt.all(sourceChatId) as RawChatMessage[];
        const messagesToCopy = sourceMessages.filter(m => !excludedMessageIds.includes(m.id));

        if (messagesToCopy.length > 0) {
            const insertStmt = db.prepare(`
                INSERT INTO chat_messages (chat_id, role, content)
                VALUES (?, ?, ?)
            `);
            for (const msg of messagesToCopy) {
                insertStmt.run(newChat.id, msg.role, msg.content);
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
        const newChat = mapChat(createStmt.get(newTitle) as RawChat);

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
                INSERT INTO chat_messages (chat_id, role, content)
                VALUES (?, ?, ?)
            `);
            for (const msg of messagesToCopy) {
                insertStmt.run(newChat.id, msg.role, msg.content);
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