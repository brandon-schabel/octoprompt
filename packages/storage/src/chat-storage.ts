// Chat storage layer using proper database columns instead of JSON
import { z } from 'zod'
import { ChatSchema, ChatMessageSchema, type Chat, type ChatMessage } from '@promptliano/schemas'
import { normalizeToUnixMs } from '@promptliano/shared/src/utils/parse-timestamp'
import { DatabaseManager, getDb } from './database-manager'
import { ApiError } from '@promptliano/shared'

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

/**
 * Safely parse JSON with fallback value and error logging.
 */
function safeJsonParse<T>(json: string | null | undefined, fallback: T, context?: string): T {
  if (!json) return fallback

  try {
    return JSON.parse(json)
  } catch (error) {
    console.warn(`Failed to parse JSON${context ? ` for ${context}` : ''}: ${json}`, error)
    return fallback
  }
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
      const database = db.getDatabase()

      // Query chats directly from columns
      const query = database.prepare(`
        SELECT 
          id, title, project_id, created_at, updated_at
        FROM ${CHATS_TABLE}
        ORDER BY created_at DESC
      `)

      const rows = query.all() as any[]

      // Convert rows to ChatsStorage
      const chats: ChatsStorage = {}
      for (const row of rows) {
        const chat: Chat = {
          id: row.id,
          title: row.title,
          projectId: row.project_id || undefined,
          created: row.created_at,
          updated: row.updated_at
        }

        // Validate each chat
        const validatedChat = await validateData(chat, ChatSchema, `chat ${chat.id}`)
        chats[String(validatedChat.id)] = validatedChat
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
      const database = db.getDatabase()

      // Validate the entire storage structure
      const validatedChats = await validateData(chats, ChatsStorageSchema, 'chats storage')

      // Clear and write all chats atomically
      database.transaction(() => {
        // Clear existing chats
        database.exec(`DELETE FROM ${CHATS_TABLE}`)

        // Prepare insert statement
        const insertQuery = database.prepare(`
          INSERT INTO ${CHATS_TABLE} (id, title, project_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `)

        // Write all chats
        for (const [chatId, chat] of Object.entries(validatedChats)) {
          insertQuery.run(chat.id, chat.title, chat.projectId || null, chat.created, chat.updated)
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
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, title, project_id, created_at, updated_at
        FROM ${CHATS_TABLE}
        WHERE id = ?
      `)

      const row = query.get(chatId) as any

      if (!row) {
        return null
      }

      const chat: Chat = {
        id: row.id,
        title: row.title,
        projectId: row.project_id || undefined,
        created: row.created_at,
        updated: row.updated_at
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
      const database = db.getDatabase()

      // Query messages directly from columns
      const query = database.prepare(`
        SELECT 
          id, chat_id, role, content, type, attachments, created_at, updated_at
        FROM ${CHAT_MESSAGES_TABLE}
        WHERE chat_id = ?
        ORDER BY created_at ASC
      `)

      const rows = query.all(chatId) as any[]

      // Convert array to ChatMessagesStorage (Record keyed by messageId)
      const messagesStorage: ChatMessagesStorage = {}
      for (const row of rows) {
        const message: ChatMessage = {
          id: row.id,
          chatId: row.chat_id,
          role: row.role,
          content: row.content,
          type: row.type || undefined,
          attachments: safeJsonParse(row.attachments, [], 'message.attachments'),
          created: row.created_at,
          updated: row.updated_at
        }

        // Validate each message
        const validatedMessage = await validateData(
          message,
          ChatMessageSchema,
          `message ${message.id} in chat ${chatId}`
        )
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
      const database = db.getDatabase()

      // Validate the messages storage structure
      const validatedMessages = await validateData(messages, ChatMessagesStorageSchema, `messages for chat ${chatId}`)

      // Use raw database transaction for atomic updates
      database.transaction(() => {
        // First, delete all existing messages for this chat
        const deleteQuery = database.prepare(`
          DELETE FROM ${CHAT_MESSAGES_TABLE}
          WHERE chat_id = ?
        `)
        deleteQuery.run(chatId)

        // Prepare insert statement
        const insertQuery = database.prepare(`
          INSERT INTO ${CHAT_MESSAGES_TABLE} 
          (id, chat_id, role, content, type, attachments, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)

        // Write all new messages
        for (const [messageId, message] of Object.entries(validatedMessages)) {
          insertQuery.run(
            message.id,
            message.chatId,
            message.role,
            message.content,
            message.type || null,
            JSON.stringify(message.attachments || []),
            message.created,
            message.updated
          )
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
      const database = db.getDatabase()

      database.transaction(() => {
        // Delete the chat (messages will be deleted by CASCADE)
        const chatDeleteQuery = database.prepare(`DELETE FROM ${CHATS_TABLE} WHERE id = ?`)
        const chatResult = chatDeleteQuery.run(chatId)

        if (chatResult.changes === 0) {
          console.warn(`Chat ${chatId} not found, nothing to delete`)
        } else {
          console.log(`Deleted chat ${chatId} and associated messages`)
        }
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
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, title, project_id, created_at, updated_at
        FROM ${CHATS_TABLE}
        WHERE created_at >= ? AND created_at <= ?
        ORDER BY created_at DESC
      `)

      const rows = query.all(startTime, endTime) as any[]

      // Convert and validate each chat
      const validatedChats: Chat[] = []
      for (const row of rows) {
        const chat: Chat = {
          id: row.id,
          title: row.title,
          projectId: row.project_id || undefined,
          created: row.created_at,
          updated: row.updated_at
        }
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
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT COUNT(*) as count 
        FROM ${CHAT_MESSAGES_TABLE}
        WHERE chat_id = ?
      `)

      const result = query.get(chatId) as { count: number }
      return result.count
    } catch (error: any) {
      console.error(`Error counting messages for chat ${chatId}:`, error)
      throw new ApiError(500, `Failed to count messages for chat ${chatId}`, error)
    }
  }

  /** Get a single message by ID. */
  async getMessageById(messageId: number): Promise<ChatMessage | null> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, chat_id, role, content, type, attachments, created_at, updated_at
        FROM ${CHAT_MESSAGES_TABLE}
        WHERE id = ?
      `)

      const row = query.get(messageId) as any

      if (!row) {
        return null
      }

      const message: ChatMessage = {
        id: row.id,
        chatId: row.chat_id,
        role: row.role,
        content: row.content,
        type: row.type || undefined,
        attachments: safeJsonParse(row.attachments, [], 'message.attachments'),
        created: row.created_at,
        updated: row.updated_at
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
      const database = db.getDatabase()

      // Validate the message
      const validatedMessage = await validateData(message, ChatMessageSchema, `message ${message.id}`)

      // Insert the message
      const insertQuery = database.prepare(`
        INSERT INTO ${CHAT_MESSAGES_TABLE} 
        (id, chat_id, role, content, type, attachments, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      insertQuery.run(
        validatedMessage.id,
        validatedMessage.chatId,
        validatedMessage.role,
        validatedMessage.content,
        validatedMessage.type || null,
        JSON.stringify(validatedMessage.attachments || []),
        validatedMessage.created,
        validatedMessage.updated
      )

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
      const database = db.getDatabase()

      // Validate the message
      const validatedMessage = await validateData(message, ChatMessageSchema, `message ${messageId}`)

      // Update the message
      const updateQuery = database.prepare(`
        UPDATE ${CHAT_MESSAGES_TABLE}
        SET role = ?, content = ?, type = ?, attachments = ?, updated_at = ?
        WHERE id = ?
      `)

      const result = updateQuery.run(
        validatedMessage.role,
        validatedMessage.content,
        validatedMessage.type || null,
        JSON.stringify(validatedMessage.attachments || []),
        validatedMessage.updated,
        messageId
      )

      return result.changes > 0
    } catch (error: any) {
      console.error(`Error updating message ${messageId}:`, error)
      throw new ApiError(500, `Failed to update message ${messageId}`, error)
    }
  }

  /** Delete a single message. */
  async deleteMessage(messageId: number): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const deleteQuery = database.prepare(`
        DELETE FROM ${CHAT_MESSAGES_TABLE}
        WHERE id = ?
      `)

      const result = deleteQuery.run(messageId)
      return result.changes > 0
    } catch (error: any) {
      console.error(`Error deleting message ${messageId}:`, error)
      throw new ApiError(500, `Failed to delete message ${messageId}`, error)
    }
  }
}

// Export singleton instance
export const chatStorage = new ChatStorage()
