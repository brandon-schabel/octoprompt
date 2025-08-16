// Chat storage layer using BaseStorage pattern - split into Chat and ChatMessage
import { z } from 'zod'
import { 
  ChatSchema, 
  ChatMessageSchema, 
  type Chat, 
  type ChatMessage 
} from '@promptliano/schemas'
import { BaseStorage } from './base-storage'
import { 
  createEntityConverter,
  createStandardMappings,
  getInsertColumnsFromMappings,
  getInsertValuesFromEntity
} from './utils/storage-helpers'
import { SqliteConverters } from '@promptliano/shared/src/utils/sqlite-converters'
import { ChatErrors } from '@promptliano/shared/src/error/entity-errors'
import { withTransaction, replaceEntities } from './utils/transaction-helpers'

// Storage schemas for validation
export const ChatsStorageSchema = z.record(z.string(), ChatSchema)
export type ChatsStorage = z.infer<typeof ChatsStorageSchema>

export const ChatMessagesStorageSchema = z.record(z.string(), ChatMessageSchema)
export type ChatMessagesStorage = z.infer<typeof ChatMessagesStorageSchema>

/**
 * Chat storage implementation using BaseStorage
 * Part 1: Chat entity management
 */
class ChatStorageClass extends BaseStorage<Chat, ChatsStorage> {
  protected readonly tableName = 'chats'
  protected readonly entitySchema = ChatSchema
  protected readonly storageSchema = ChatsStorageSchema

  private readonly fieldMappings = {
    id: { dbColumn: 'id', converter: (v: any) => SqliteConverters.toNumber(v) },
    title: { dbColumn: 'title', converter: (v: any) => SqliteConverters.toString(v) },
    projectId: { dbColumn: 'project_id', converter: (v: any) => v != null ? SqliteConverters.toNumber(v) : undefined },
    created: { dbColumn: 'created_at', converter: (v: any) => SqliteConverters.toTimestamp(v) },
    updated: { dbColumn: 'updated_at', converter: (v: any) => SqliteConverters.toTimestamp(v) }
  }

  private readonly converter = createEntityConverter(
    this.entitySchema,
    this.fieldMappings
  )

  protected rowToEntity(row: any): Chat {
    return this.converter(row)
  }

  protected getSelectColumns(): string[] {
    return [
      'id', 'project_id', 'title', 'created_at', 'updated_at'
    ]
  }

  protected getInsertColumns(): string[] {
    return getInsertColumnsFromMappings(this.fieldMappings)
  }

  protected getInsertValues(entity: Chat): any[] {
    return getInsertValuesFromEntity(entity, this.fieldMappings)
  }

  // === Custom Methods ===

  async readChats(): Promise<ChatsStorage> {
    return this.readAll()
  }

  async writeChats(chats: ChatsStorage): Promise<ChatsStorage> {
    return this.writeAll(chats)
  }

  async getChatById(chatId: number): Promise<Chat | null> {
    return this.getById(chatId)
  }

  async findChatsByDateRange(startTime: number, endTime: number): Promise<Chat[]> {
    const db = this.getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT ${this.getSelectColumns().join(', ')}
      FROM ${this.tableName}
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `)

    const rows = query.all(startTime, endTime) as any[]
    return rows.map(row => this.rowToEntity(row))
  }

  async deleteChatData(chatId: number): Promise<void> {
    const db = this.getDb()
    const database = db.getDatabase()

    withTransaction(database, () => {
      // Delete all messages for this chat
      database.prepare(`DELETE FROM chat_messages WHERE chat_id = ?`).run(chatId)
      // Delete the chat itself
      database.prepare(`DELETE FROM chats WHERE id = ?`).run(chatId)
    })
  }
}

/**
 * ChatMessage storage implementation using BaseStorage
 * Part 2: Message entity management
 */
class ChatMessageStorageClass extends BaseStorage<ChatMessage, ChatMessagesStorage> {
  protected readonly tableName = 'chat_messages'
  protected readonly entitySchema = ChatMessageSchema
  protected readonly storageSchema = ChatMessagesStorageSchema

  private readonly fieldMappings = createStandardMappings<ChatMessage>({
    chatId: { dbColumn: 'chat_id', converter: (v) => SqliteConverters.toNumber(v) },
    role: 'role',
    content: 'content',
    type: { dbColumn: 'type', converter: (v) => v || undefined },
    attachments: { dbColumn: 'attachments', converter: (v) => v ? JSON.parse(v as string) : [] }
  })

  private readonly converter = createEntityConverter(
    this.entitySchema,
    this.fieldMappings
  )

  protected rowToEntity(row: any): ChatMessage {
    return this.converter(row)
  }

  protected getSelectColumns(): string[] {
    return [
      'id', 'chat_id', 'role', 'content', 'type', 'attachments',
      'created_at', 'updated_at'
    ]
  }

  protected getInsertColumns(): string[] {
    return getInsertColumnsFromMappings(this.fieldMappings)
  }

  protected getInsertValues(entity: ChatMessage): any[] {
    const values = getInsertValuesFromEntity(entity, this.fieldMappings)
    // Handle attachments serialization
    const attachmentsIndex = this.getInsertColumns().indexOf('attachments')
    if (attachmentsIndex !== -1 && entity.attachments) {
      values[attachmentsIndex] = JSON.stringify(entity.attachments)
    }
    return values
  }

  // === Custom Methods ===

  async readChatMessages(chatId: number): Promise<ChatMessagesStorage> {
    return this.readAll('chat_id = ?', [chatId])
  }

  async writeChatMessages(chatId: number, messages: ChatMessagesStorage): Promise<ChatMessagesStorage> {
    const db = this.getDb()
    const database = db.getDatabase()

    // Ensure all messages have the correct chatId
    const messagesWithChatId: ChatMessagesStorage = {}
    for (const [id, message] of Object.entries(messages)) {
      messagesWithChatId[id] = { ...message, chatId }
    }

    return withTransaction(database, () => {
      // Delete existing messages for this chat
      database.prepare(`DELETE FROM ${this.tableName} WHERE chat_id = ?`).run(chatId)
      
      // Insert new messages
      for (const message of Object.values(messagesWithChatId)) {
        this.add(message)
      }
      
      return messagesWithChatId
    })
  }

  async getMessageById(messageId: number): Promise<ChatMessage | null> {
    return this.getById(messageId)
  }

  async countMessagesForChat(chatId: number): Promise<number> {
    return this.count('chat_id = ?', [chatId])
  }

  async addMessage(message: ChatMessage): Promise<ChatMessage> {
    return this.add(message)
  }

  async updateMessage(messageId: number, message: ChatMessage): Promise<boolean> {
    const result = await this.update(messageId, message)
    return result !== null
  }

  async deleteMessage(messageId: number): Promise<boolean> {
    return this.delete(messageId)
  }

  async getLatestMessagesForChat(chatId: number, limit: number = 50): Promise<ChatMessage[]> {
    const db = this.getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT ${this.getSelectColumns().join(', ')}
      FROM ${this.tableName}
      WHERE chat_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)

    const rows = query.all(chatId, limit) as any[]
    return rows.map(row => this.rowToEntity(row)).reverse() // Reverse to get chronological order
  }
}

// Create singleton instances
const chatStorageInstance = new ChatStorageClass()
const chatMessageStorageInstance = new ChatMessageStorageClass()

// Export the combined storage object for backward compatibility
export const chatStorage = {
  // Chat methods
  readChats: () => chatStorageInstance.readChats(),
  writeChats: (chats: ChatsStorage) => chatStorageInstance.writeChats(chats),
  getChatById: (chatId: number) => chatStorageInstance.getChatById(chatId),
  findChatsByDateRange: (startTime: number, endTime: number) => 
    chatStorageInstance.findChatsByDateRange(startTime, endTime),
  deleteChatData: (chatId: number) => chatStorageInstance.deleteChatData(chatId),
  
  // ChatMessage methods
  readChatMessages: (chatId: number) => chatMessageStorageInstance.readChatMessages(chatId),
  writeChatMessages: (chatId: number, messages: ChatMessagesStorage) => 
    chatMessageStorageInstance.writeChatMessages(chatId, messages),
  getMessageById: (messageId: number) => chatMessageStorageInstance.getMessageById(messageId),
  countMessagesForChat: (chatId: number) => chatMessageStorageInstance.countMessagesForChat(chatId),
  addMessage: (message: ChatMessage) => chatMessageStorageInstance.addMessage(message),
  updateMessage: (messageId: number, message: ChatMessage) => 
    chatMessageStorageInstance.updateMessage(messageId, message),
  deleteMessage: (messageId: number) => chatMessageStorageInstance.deleteMessage(messageId),
  
  // Utility methods
  generateId: () => chatStorageInstance.generateId(),
  generateMessageId: () => chatMessageStorageInstance.generateId()
}