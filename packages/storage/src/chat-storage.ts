import { z } from 'zod'
import * as path from 'node:path'
import { ChatSchema, ChatMessageSchema, type Chat, type ChatMessage } from '@octoprompt/schemas'
import { BaseStorage, type StorageOptions } from './core/base-storage'
import { STORAGE_CONFIG } from './config'

// Storage schemas
export const ChatsStorageSchema = z.record(z.string(), ChatSchema)
export type ChatsStorage = z.infer<typeof ChatsStorageSchema>

export const ChatMessagesStorageSchema = z.record(z.string(), ChatMessageSchema)
export type ChatMessagesStorage = z.infer<typeof ChatMessagesStorageSchema>

/**
 * Enhanced chat storage with indexing, caching, and full-text search
 */
export class ChatStorage extends BaseStorage<Chat, ChatsStorage> {
  private messageStorages: Map<number, ChatMessageStorage> = new Map()

  constructor(options: StorageOptions = {}) {
    const dataDir = path.join('data', 'chat_storage')
    super(ChatsStorageSchema, ChatSchema, dataDir, options)
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'chats.json')
  }

  protected getEntityPath(id: number): string {
    return path.join(this.basePath, this.dataDir, 'chat_data', id.toString())
  }

  // Override create to initialize message storage
  public async create(data: Omit<Chat, 'id' | 'created' | 'updated'>): Promise<Chat> {
    const chat = await super.create(data)

    // Initialize empty message storage
    const messageStorage = this.getMessageStorage(chat.id)
    await messageStorage.writeAll({})

    return chat
  }

  // Override delete to clean up message storage
  public async delete(id: number): Promise<boolean> {
    const result = await super.delete(id)
    if (result) {
      // Clean up message storage cache
      this.messageStorages.delete(id)
    }
    return result
  }

  // --- Query Methods Using Indexes ---

  /**
   * Search chats by title (supports partial matching)
   */
  public async searchByTitle(query: string): Promise<Chat[]> {
    const all = await this.list()
    const lowercaseQuery = query.toLowerCase()
    return all
      .filter(chat => chat.title.toLowerCase().includes(lowercaseQuery))
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get chats by project ID
   */
  public async getByProject(projectId: number): Promise<Chat[]> {
    const all = await this.list()
    return all
      .filter(chat => chat.projectId === projectId)
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get chats within date range
   */
  public async getByDateRange(start: Date, end: Date): Promise<Chat[]> {
    const all = await this.list()
    const startMs = start.getTime()
    const endMs = end.getTime()
    return all
      .filter(chat => chat.created >= startMs && chat.created <= endMs)
      .sort((a, b) => b.created - a.created)
  }

  /**
   * Get chats that were active in a date range
   */
  public async getActiveInRange(start: Date, end: Date): Promise<Chat[]> {
    const all = await this.list()
    const startMs = start.getTime()
    const endMs = end.getTime()
    return all
      .filter(chat => chat.updated >= startMs && chat.updated <= endMs)
      .sort((a, b) => b.updated - a.updated)
  }

  // --- Message Management ---

  public getMessageStorage(chatId: number): ChatMessageStorage {
    let storage = this.messageStorages.get(chatId)
    if (!storage) {
      storage = new ChatMessageStorage(chatId, this.options)
      this.messageStorages.set(chatId, storage)
    }
    return storage
  }

  public async getMessages(
    chatId: number,
    options?: {
      limit?: number
      offset?: number
      since?: Date
      until?: Date
    }
  ): Promise<ChatMessage[]> {
    const messageStorage = this.getMessageStorage(chatId)
    return messageStorage.getMessages(options)
  }

  public async addMessage(
    chatId: number,
    message: Omit<ChatMessage, 'id' | 'created' | 'updated'>
  ): Promise<ChatMessage> {
    const messageStorage = this.getMessageStorage(chatId)
    const newMessage = await messageStorage.addMessage(message)

    // Update chat's updated timestamp (this is done automatically by the update method)

    return newMessage
  }

  public async getMessageById(chatId: number, messageId: number): Promise<ChatMessage | null> {
    const messageStorage = this.getMessageStorage(chatId)
    return messageStorage.getById(messageId)
  }

  public async searchMessages(chatId: number, query: string): Promise<ChatMessage[]> {
    const messageStorage = this.getMessageStorage(chatId)
    return messageStorage.searchContent(query)
  }

  public async getMessageCount(chatId: number): Promise<number> {
    const messageStorage = this.getMessageStorage(chatId)
    const messages = await messageStorage.list()
    return messages.length
  }
}

/**
 * Storage for chat messages with full-text search
 */
export class ChatMessageStorage extends BaseStorage<ChatMessage, ChatMessagesStorage> {
  private chatId: number

  constructor(chatId: number, options: StorageOptions = {}) {
    const dataDir = path.join('data', 'chat_storage', 'chat_data', chatId.toString())
    super(ChatMessagesStorageSchema, ChatMessageSchema, dataDir, options)

    this.chatId = chatId
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'messages.json')
  }

  protected getEntityPath(id: number): string | null {
    // Messages don't have separate entity paths
    return null
  }

  // Override create to use string ID
  public async create(data: Omit<ChatMessage, 'id' | 'created' | 'updated'>): Promise<ChatMessage> {
    // Generate string ID for messages
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()

    const messageData = {
      ...data,
      id: messageId,
      chatId: this.chatId,
      created: now,
      updated: now
    }

    const validated = await this.entitySchema.parseAsync(messageData)
    const all = await this.readAll()
    all[messageId] = validated
    await this.writeAll(all)


    return validated
  }

  // Add message convenience method
  public async addMessage(data: Omit<ChatMessage, 'id' | 'created' | 'updated'>): Promise<ChatMessage> {
    return this.create(data)
  }

  // Get messages with filtering options
  public async getMessages(options?: {
    limit?: number
    offset?: number
    since?: Date
    until?: Date
    role?: string
  }): Promise<ChatMessage[]> {
    let messages = await this.list()

    // Filter by role if specified
    if (options?.role) {
      messages = messages.filter((msg) => msg.role === options.role)
    }

    // Filter by date range
    if (options?.since || options?.until) {
      messages = messages.filter((msg) => {
        if (options.since && msg.created < options.since.getTime()) return false
        if (options.until && msg.created > options.until.getTime()) return false
        return true
      })
    }

    // Sort by creation time (oldest first for chat context)
    messages.sort((a, b) => a.created - b.created)

    // Apply pagination
    if (options?.offset || options?.limit) {
      const start = options.offset || 0
      const end = options.limit ? start + options.limit : undefined
      messages = messages.slice(start, end)
    }

    return messages
  }

  // Search message content
  public async searchContent(query: string): Promise<ChatMessage[]> {
    const all = await this.list()
    const lowercaseQuery = query.toLowerCase()
    return all
      .filter(msg => msg.content.toLowerCase().includes(lowercaseQuery))
      .sort((a, b) => a.created - b.created)
  }

  // Get messages by role
  public async getByRole(role: string): Promise<ChatMessage[]> {
    const all = await this.list()
    return all
      .filter(msg => msg.role === role)
      .sort((a, b) => a.created - b.created)
  }

  // Get latest messages
  public async getLatest(count: number = 10): Promise<ChatMessage[]> {
    const all = await this.list()
    return all
      .sort((a, b) => b.created - a.created)
      .slice(0, count)
  }
}

// Export singleton instance for backward compatibility
export const chatStorage = new ChatStorage({
  ...STORAGE_CONFIG,
  cacheTTL: 10 * 60 * 1000, // 10 minutes for chat data
  maxCacheSize: 500 // Cache up to 500 chats
})
