import { z } from 'zod'
import { ChatSchema, ChatMessageSchema, type Chat, type ChatMessage } from '@octoprompt/schemas'
import { normalizeToUnixMs } from '@octoprompt/shared/src/utils/parse-timestamp'
import { DatabaseManager, getDb } from './database-manager'
import { ApiError } from '@octoprompt/shared'

// Table names for database storage
const CHATS_TABLE = 'chats'
const CHAT_MESSAGES_TABLE = 'chat_messages'

// --- Schemas for Storage ---
// Store all chats (metadata) as a map (Record) keyed by chatId
export const ChatsStorageSchema = z.record(z.string(), ChatSchema)
export type ChatsStorage = z.infer<typeof ChatsStorageSchema>

// Store messages within a specific chat as a map (Record) keyed by messageId
export const ChatMessagesStorageSchema = z.record(z.string(), ChatMessageSchema)
export type ChatMessagesStorage = z.infer<typeof ChatMessagesStorageSchema>

// --- Database Helper Functions ---

/**
 * Validates data against a schema and returns the validated data.
 */
async function validateData<T>(data: unknown, schema: z.ZodSchema<T>, context: string): Promise<T> {
  const validationResult = await schema.safeParseAsync(data)
  if (!validationResult.success) {
    console.error(`Zod validation failed for ${context}:`, validationResult.error.errors)
    throw new ApiError(400, `Validation failed for ${context}`, validationResult.error.errors)
  }
  return validationResult.data
}

// --- Specific Data Accessors ---

class ChatStorage {
  /**
   * Get database instance lazily. Always get fresh instance to avoid closed db issues.
   */
  private getDb(): DatabaseManager {
    return getDb()
  }

  /** Reads all chats from the database. */
  async readChats(): Promise<ChatsStorage> {
    try {
      const db = this.getDb()
      const chatMap = await db.getAll<Chat>(CHATS_TABLE)

      // Convert Map to ChatsStorage (Record)
      const chats: ChatsStorage = {}
      for (const [id, chat] of chatMap) {
        // Validate each chat
        const validatedChat = await validateData(chat, ChatSchema, `chat ${id}`)
        chats[String(id)] = validatedChat
      }

      return chats
    } catch (error: any) {
      console.error('Error reading chats from database:', error)
      throw new ApiError(500, 'Failed to read chats', error)
    }
  }

  /** Writes all chats to the database. */
  async writeChats(chats: ChatsStorage): Promise<ChatsStorage> {
    try {
      const db = this.getDb()

      // Validate the entire storage structure
      const validatedChats = await validateData(chats, ChatsStorageSchema, 'chats storage')

      // Clear and write all chats atomically
      // Note: Since Bun SQLite transactions are synchronous, we'll handle this differently
      const database = db.getDatabase()

      database.transaction(() => {
        // Clear existing chats
        database.exec(`DELETE FROM ${CHATS_TABLE}`)

        // Write all chats
        const now = Date.now()
        const insertQuery = database.prepare(`
          INSERT INTO ${CHATS_TABLE} (id, data, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `)

        for (const [chatId, chat] of Object.entries(validatedChats)) {
          insertQuery.run(chatId, JSON.stringify(chat), now, now)
        }
      })()

      return validatedChats
    } catch (error: any) {
      console.error('Error writing chats to database:', error)
      throw new ApiError(500, 'Failed to write chats', error)
    }
  }

  /** Gets a specific chat by ID. */
  async getChatById(chatId: number): Promise<Chat | null> {
    try {
      const db = this.getDb()
      const chat = await db.get<Chat>(CHATS_TABLE, String(chatId))

      if (!chat) {
        return null
      }

      // Validate the chat data
      return await validateData(chat, ChatSchema, `chat ${chatId}`)
    } catch (error: any) {
      console.error(`Error reading chat ${chatId} from database:`, error)
      throw new ApiError(500, `Failed to read chat ${chatId}`, error)
    }
  }

  /** Reads all messages for a specific chat. */
  async readChatMessages(chatId: number): Promise<ChatMessagesStorage> {
    try {
      const db = this.getDb()

      // Find all messages for this chat using JSON query
      const messages = await db.findByJsonField<ChatMessage>(CHAT_MESSAGES_TABLE, '$.chatId', chatId)

      // Convert array to ChatMessagesStorage (Record keyed by messageId)
      const messagesStorage: ChatMessagesStorage = {}
      for (const message of messages) {
        // Validate each message
        const validatedMessage = await validateData(message, ChatMessageSchema, `message in chat ${chatId}`)
        messagesStorage[String(validatedMessage.id)] = validatedMessage
      }

      return messagesStorage
    } catch (error: any) {
      console.error(`Error reading messages for chat ${chatId} from database:`, error)
      throw new ApiError(500, `Failed to read messages for chat ${chatId}`, error)
    }
  }

  /** Writes messages for a specific chat. */
  async writeChatMessages(chatId: number, messages: ChatMessagesStorage): Promise<ChatMessagesStorage> {
    try {
      const db = this.getDb()

      // Validate the messages storage structure
      const validatedMessages = await validateData(messages, ChatMessagesStorageSchema, `messages for chat ${chatId}`)

      // Use raw database transaction for atomic updates
      const database = db.getDatabase()

      database.transaction(() => {
        // First, delete all existing messages for this chat
        const deleteQuery = database.prepare(`
          DELETE FROM ${CHAT_MESSAGES_TABLE}
          WHERE JSON_EXTRACT(data, '$.chatId') = ?
        `)
        deleteQuery.run(chatId)

        // Write all new messages
        const now = Date.now()
        const insertQuery = database.prepare(`
          INSERT INTO ${CHAT_MESSAGES_TABLE} (id, data, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `)

        for (const [messageId, message] of Object.entries(validatedMessages)) {
          insertQuery.run(messageId, JSON.stringify(message), now, now)
        }
      })()

      return validatedMessages
    } catch (error: any) {
      console.error(`Error writing messages for chat ${chatId} to database:`, error)
      throw new ApiError(500, `Failed to write messages for chat ${chatId}`, error)
    }
  }

  /** Deletes a chat and all its messages. */
  async deleteChatData(chatId: number): Promise<void> {
    try {
      const db = this.getDb()

      // Use raw database transaction to ensure atomic deletion
      const database = db.getDatabase()

      database.transaction(() => {
        // Delete the chat
        const chatDeleteQuery = database.prepare(`DELETE FROM ${CHATS_TABLE} WHERE id = ?`)
        const chatResult = chatDeleteQuery.run(String(chatId))

        if (chatResult.changes === 0) {
          console.warn(`Chat ${chatId} not found, nothing to delete`)
        }

        // Delete all messages for this chat
        const messageDeleteQuery = database.prepare(`
          DELETE FROM ${CHAT_MESSAGES_TABLE}
          WHERE JSON_EXTRACT(data, '$.chatId') = ?
        `)
        const messageResult = messageDeleteQuery.run(chatId)

        console.log(`Deleted chat ${chatId} and ${messageResult.changes} associated messages`)
      })()
    } catch (error: any) {
      console.error(`Error deleting chat ${chatId} from database:`, error)
      throw new ApiError(500, `Failed to delete chat ${chatId}`, error)
    }
  }

  /** Generates a unique ID. */
  generateId(): number {
    return normalizeToUnixMs(new Date())
  }

  /**
   * Additional utility methods leveraging database capabilities
   */

  /** Find chats created within a date range. */
  async findChatsByDateRange(startTime: number, endTime: number): Promise<Chat[]> {
    try {
      const db = this.getDb()
      const chats = await db.findByDateRange<Chat>(CHATS_TABLE, startTime, endTime)

      // Validate each chat
      const validatedChats: Chat[] = []
      for (const chat of chats) {
        const validated = await validateData(chat, ChatSchema, `chat ${chat.id}`)
        validatedChats.push(validated)
      }

      return validatedChats
    } catch (error: any) {
      console.error('Error finding chats by date range:', error)
      throw new ApiError(500, 'Failed to find chats by date range', error)
    }
  }

  /** Count messages for a specific chat. */
  async countMessagesForChat(chatId: number): Promise<number> {
    try {
      const db = this.getDb()
      return await db.countByJsonField(CHAT_MESSAGES_TABLE, '$.chatId', chatId)
    } catch (error: any) {
      console.error(`Error counting messages for chat ${chatId}:`, error)
      throw new ApiError(500, `Failed to count messages for chat ${chatId}`, error)
    }
  }

  /** Get a single message by ID. */
  async getMessageById(messageId: number): Promise<ChatMessage | null> {
    try {
      const db = this.getDb()
      const message = await db.get<ChatMessage>(CHAT_MESSAGES_TABLE, String(messageId))

      if (!message) {
        return null
      }

      // Validate the message data
      return await validateData(message, ChatMessageSchema, `message ${messageId}`)
    } catch (error: any) {
      console.error(`Error reading message ${messageId} from database:`, error)
      throw new ApiError(500, `Failed to read message ${messageId}`, error)
    }
  }

  /** Add a single message to a chat. */
  async addMessage(message: ChatMessage): Promise<ChatMessage> {
    try {
      const db = this.getDb()

      // Validate the message
      const validatedMessage = await validateData(message, ChatMessageSchema, `message ${message.id}`)

      // Create the message
      await db.create(CHAT_MESSAGES_TABLE, String(validatedMessage.id), validatedMessage)

      return validatedMessage
    } catch (error: any) {
      console.error(`Error adding message to chat ${message.chatId}:`, error)
      throw new ApiError(500, `Failed to add message to chat ${message.chatId}`, error)
    }
  }

  /** Update a single message. */
  async updateMessage(messageId: number, message: ChatMessage): Promise<boolean> {
    try {
      const db = this.getDb()

      // Validate the message
      const validatedMessage = await validateData(message, ChatMessageSchema, `message ${messageId}`)

      // Update the message
      return await db.update(CHAT_MESSAGES_TABLE, String(messageId), validatedMessage)
    } catch (error: any) {
      console.error(`Error updating message ${messageId}:`, error)
      throw new ApiError(500, `Failed to update message ${messageId}`, error)
    }
  }

  /** Delete a single message. */
  async deleteMessage(messageId: number): Promise<boolean> {
    try {
      const db = this.getDb()
      return await db.delete(CHAT_MESSAGES_TABLE, String(messageId))
    } catch (error: any) {
      console.error(`Error deleting message ${messageId}:`, error)
      throw new ApiError(500, `Failed to delete message ${messageId}`, error)
    }
  }
}

// Export singleton instance
export const chatStorage = new ChatStorage()
