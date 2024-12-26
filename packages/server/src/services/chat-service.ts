import { 
    chats, 
    chatMessages,
    type Chat,
    type ChatMessage,
    type ExtendedChatMessage,
    type NewChatMessage,
    eq,
} from "shared";
import { db } from "shared/database";

export class ChatService {
    /** Creates a new chat session */
    async createChat(title: string): Promise<Chat> {
        const [chat] = await db.insert(chats).values({ title }).returning();
        if (!chat) throw new Error("Failed to create chat");
        return chat;
    }

    /** Updates the chat's last activity timestamp */
    async updateChatTimestamp(chatId: string): Promise<void> {
        await db
            .update(chats)
            .set({ updatedAt: new Date() })
            .where(eq(chats.id, chatId));
    }

    /** Save a new message to the database */
    async saveMessage(message: NewChatMessage & { tempId?: string }): Promise<ExtendedChatMessage> {
        const [savedMessage] = await db.insert(chatMessages).values(message).returning();
        if (!savedMessage) throw new Error("Failed to save message");
        return { ...savedMessage, tempId: message.tempId };
    }

    /** Update an existing message (e.g. during streaming) */
    async updateMessageContent(messageId: string, content: string): Promise<void> {
        await db.update(chatMessages).set({ content }).where(eq(chatMessages.id, messageId));
    }

    /** Get all chats */
    async getAllChats(): Promise<Chat[]> {
        return db.select().from(chats).orderBy(chats.updatedAt);
    }

    /** Get all messages for a specific chat */
    async getChatMessages(chatId: string): Promise<ExtendedChatMessage[]> {
        const messages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.chatId, chatId))
            .orderBy(chatMessages.createdAt);
        return messages.map((msg: ChatMessage) => ({ ...msg }));
    }

    async updateChat(chatId: string, title: string): Promise<Chat> {
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

    /** Delete an entire chat and all its messages */
    async deleteChat(chatId: string): Promise<void> {
        await db.delete(chatMessages).where(eq(chatMessages.chatId, chatId));
        const result = await db.delete(chats).where(eq(chats.id, chatId)).returning();
        if (result.length === 0) {
            throw new Error("Chat not found");
        }
    }

    /** Delete a single message */
    async deleteMessage(messageId: string): Promise<void> {
        const result = await db.delete(chatMessages).where(eq(chatMessages.id, messageId)).returning();
        if (result.length === 0) {
            throw new Error("Message not found");
        }
    }

    /** Fork an entire chat */
    async forkChat(sourceChatId: string, excludedMessageIds: string[] = []): Promise<Chat> {
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

        // Filter out excluded messages
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

    /** Fork a chat starting from a specific message */
    async forkChatFromMessage(
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

        // Include all messages up to and including the chosen message
        let messagesToCopy = sourceMessages.slice(0, indexOfStart + 1);
        // Filter out excluded messages
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
}