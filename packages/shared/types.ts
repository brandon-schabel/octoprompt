import type { InferSelectModel } from "drizzle-orm";
import { chats, chatMessages } from "./schema";

// Export base types from schema
export type Chat = InferSelectModel<typeof chats>;
export type ChatMessage = InferSelectModel<typeof chatMessages>;

// Export extended types
export type ExtendedChatMessage = ChatMessage & {
    tempId?: string;
}; 