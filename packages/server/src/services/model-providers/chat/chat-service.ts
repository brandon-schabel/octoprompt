import { db, eq } from "@db";
import { schema } from "shared";

const { chats, chatMessages } = schema;

export type Chat = schema.Chat;
export type ChatMessage = schema.ChatMessage;
export type ExtendedChatMessage = schema.ExtendedChatMessage;
export type NewChatMessage = schema.NewChatMessage;

export type CreateChatOptions = {
    copyExisting?: boolean;
    currentChatId?: string;
};

/**
 * Returns an object of functions handling chat logic in a functional style.
 */
export function createChatService() {
    async function createChat(title: string, options?: CreateChatOptions): Promise<Chat> {
        const [chat] = await db.insert(chats).values({ title }).returning();
        if (!chat) throw new Error("Failed to create chat");

        if (options?.copyExisting && options?.currentChatId) {
            const sourceMessages = await db
                .select()
                .from(chatMessages)
                .where(eq(chatMessages.chatId, options.currentChatId))
                .orderBy(chatMessages.createdAt)
                .all();

            if (sourceMessages.length > 0) {
                const newMessages = sourceMessages.map((m: ChatMessage) => ({
                    chatId: chat.id,
                    role: m.role,
                    content: m.content,
                }));
                await db.insert(chatMessages).values(newMessages).run();
            }
        }

        return chat;
    }

    async function updateChatTimestamp(chatId: string): Promise<void> {
        await db
            .update(chats)
            .set({ updatedAt: new Date() })
            .where(eq(chats.id, chatId));
    }

    async function saveMessage(message: NewChatMessage & { tempId?: string }): Promise<ExtendedChatMessage> {
        const [savedMessage] = await db.insert(chatMessages).values(message).returning();
        if (!savedMessage) throw new Error("Failed to save message");
        return { ...savedMessage, tempId: message.tempId };
    }

    async function updateMessageContent(messageId: string, content: string): Promise<void> {
        await db
            .update(chatMessages)
            .set({ content })
            .where(eq(chatMessages.id, messageId));
    }

    async function getAllChats(): Promise<Chat[]> {
        return db.select().from(chats).orderBy(chats.updatedAt);
    }

    async function getChatMessages(chatId: string): Promise<ExtendedChatMessage[]> {
        const messages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.chatId, chatId))
            .orderBy(chatMessages.createdAt);

        return messages.map((msg: ChatMessage) => ({ ...msg }));
    }

    async function updateChat(chatId: string, title: string): Promise<Chat> {
        const [updatedChat] = await db
            .update(chats)
            .set({ title })
            .where(eq(chats.id, chatId))
            .returning();

        if (!updatedChat) {
            throw new Error("Chat not found");
        }
        return updatedChat;
    }

    async function deleteChat(chatId: string): Promise<void> {
        await db.delete(chatMessages).where(eq(chatMessages.chatId, chatId));
        const result = await db.delete(chats).where(eq(chats.id, chatId)).returning();
        if (result.length === 0) {
            throw new Error("Chat not found");
        }
    }

    async function deleteMessage(messageId: string): Promise<void> {
        const result = await db.delete(chatMessages).where(eq(chatMessages.id, messageId)).returning();
        if (result.length === 0) {
            throw new Error("Message not found");
        }
    }

    async function forkChat(sourceChatId: string, excludedMessageIds: string[] = []): Promise<Chat> {
        const sourceChat = await db.select().from(chats).where(eq(chats.id, sourceChatId)).get();
        if (!sourceChat) {
            throw new Error("Source chat not found");
        }

        const newTitle = `Fork of ${sourceChat.title} (${new Date().toLocaleTimeString()})`;
        const [newChat] = await db
            .insert(chats)
            .values({ title: newTitle })
            .returning();

        if (!newChat) {
            throw new Error("Failed to fork chat");
        }

        const sourceMessages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.chatId, sourceChatId))
            .orderBy(chatMessages.createdAt)
            .all();

        const messagesToCopy = sourceMessages.filter((m: ChatMessage) => !excludedMessageIds.includes(m.id));

        if (messagesToCopy.length > 0) {
            const newMessages = messagesToCopy.map((m: ChatMessage) => ({
                chatId: newChat.id,
                role: m.role,
                content: m.content,
            }));
            await db.insert(chatMessages).values(newMessages).run();
        }

        return newChat;
    }

    async function forkChatFromMessage(
        sourceChatId: string,
        messageId: string,
        excludedMessageIds: string[] = []
    ): Promise<Chat> {
        const sourceChat = await db.select().from(chats).where(eq(chats.id, sourceChatId)).get();
        if (!sourceChat) {
            throw new Error("Source chat not found");
        }

        const startMessage = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).get();
        if (!startMessage) {
            throw new Error("Starting message not found");
        }

        if (startMessage.chatId !== sourceChatId) {
            throw new Error("Message does not belong to the specified chat");
        }

        const newTitle = `Fork from ${sourceChat.title} at ${new Date().toLocaleTimeString()}`;
        const [newChat] = await db
            .insert(chats)
            .values({ title: newTitle })
            .returning();

        if (!newChat) {
            throw new Error("Failed to fork chat");
        }

        const sourceMessages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.chatId, sourceChatId))
            .orderBy(chatMessages.createdAt)
            .all();

        const indexOfStart = sourceMessages.findIndex((m: ChatMessage) => m.id === messageId);
        if (indexOfStart === -1) {
            throw new Error("Could not find the starting message in the chat sequence");
        }

        let messagesToCopy = sourceMessages.slice(0, indexOfStart + 1);
        messagesToCopy = messagesToCopy.filter((m: ChatMessage) => !excludedMessageIds.includes(m.id));

        if (messagesToCopy.length > 0) {
            const newMessages = messagesToCopy.map((m: ChatMessage) => ({
                chatId: newChat.id,
                role: m.role,
                content: m.content,
            }));
            await db.insert(chatMessages).values(newMessages).run();
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