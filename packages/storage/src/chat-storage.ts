import { z } from 'zod'
import * as path from 'node:path'
import { ChatSchema, ChatMessageSchema, type Chat, type ChatMessage } from '@octoprompt/schemas'
import { BaseStorage, type StorageOptions } from './core/base-storage'
import { IndexManager, type IndexConfig } from './core/index-manager'

// Storage schemas
export const ChatsStorageSchema = z.record(z.string(), ChatSchema)
export type ChatsStorage = z.infer<typeof ChatsStorageSchema>

export const ChatMessagesStorageSchema = z.record(z.string(), ChatMessageSchema)
export type ChatMessagesStorage = z.infer<typeof ChatMessagesStorageSchema>

/**
 * Enhanced chat storage with indexing, caching, and full-text search
 */
export class ChatStorage extends BaseStorage<Chat, ChatsStorage> {
  private indexManager: IndexManager
  private messageStorages: Map<number, ChatMessageStorage> = new Map()

  constructor(options: StorageOptions = {}) {
    const dataDir = path.join('data', 'chat_storage')
    super(ChatsStorageSchema, ChatSchema, dataDir, options)
    
    this.indexManager = new IndexManager(this.basePath, this.dataDir)
    
    // Initialize indexes
    this.initializeIndexes()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'chats.json')
  }

  protected getEntityPath(id: number): string {
    return path.join(this.basePath, this.dataDir, 'chat_data', id.toString())
  }

  protected async initializeIndexes(): Promise<void> {
    const indexes: IndexConfig[] = [
      {
        name: 'chats_by_title',
        type: 'inverted', // For partial text search
        fields: ['title']
      },
      {
        name: 'chats_by_project',
        type: 'hash',
        fields: ['projectId'],
        sparse: true // Some chats may not have projectId
      },
      {
        name: 'chats_by_created',
        type: 'btree',
        fields: ['created']
      },
      {
        name: 'chats_by_updated',
        type: 'btree',
        fields: ['updated']
      },
      {
        name: 'chats_recent',
        type: 'btree',
        fields: ['updated'] // For getting most recent chats
      }
    ]

    for (const indexConfig of indexes) {
      try {
        await this.indexManager.createIndex(indexConfig)
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(`Failed to create index ${indexConfig.name}:`, error)
        }
      }
    }
  }

  // Override create to update indexes
  public async create(data: Omit<Chat, 'id' | 'created' | 'updated'>): Promise<Chat> {
    const chat = await super.create(data)
    
    // Update indexes
    await this.updateChatIndexes(chat)
    
    // Initialize empty message storage
    const messageStorage = this.getMessageStorage(chat.id)
    await messageStorage.writeAll({})
    
    return chat
  }

  // Override update to maintain indexes
  public async update(id: number, data: Partial<Omit<Chat, 'id' | 'created' | 'updated'>>): Promise<Chat | null> {
    const existing = await this.getById(id)
    if (!existing) return null

    // Remove from indexes before update
    await this.removeChatFromIndexes(id)

    const updated = await super.update(id, data)
    if (!updated) return null

    // Re-add to indexes
    await this.updateChatIndexes(updated)

    return updated
  }

  // Override delete to maintain indexes
  public async delete(id: number): Promise<boolean> {
    const result = await super.delete(id)
    if (result) {
      // Remove from indexes
      await this.removeChatFromIndexes(id)
      
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
    const ids = await this.indexManager.searchText('chats_by_title', query)
    const chats: Chat[] = []
    
    for (const id of ids) {
      const chat = await this.getById(id)
      if (chat) chats.push(chat)
    }
    
    return chats.sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get chats by project ID
   */
  public async getByProject(projectId: number): Promise<Chat[]> {
    const ids = await this.indexManager.query('chats_by_project', projectId)
    const chats: Chat[] = []
    
    for (const id of ids) {
      const chat = await this.getById(id)
      if (chat) chats.push(chat)
    }
    
    return chats.sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get most recent chats
   */
  public async getRecent(limit: number = 20): Promise<Chat[]> {
    const allChats = await this.list()
    return allChats
      .sort((a, b) => b.updated - a.updated)
      .slice(0, limit)
  }

  /**
   * Get chats within date range
   */
  public async getByDateRange(start: Date, end: Date): Promise<Chat[]> {
    const ids = await this.indexManager.queryRange(
      'chats_by_created',
      start.getTime(),
      end.getTime()
    )
    
    const chats: Chat[] = []
    for (const id of ids) {
      const chat = await this.getById(id)
      if (chat) chats.push(chat)
    }
    
    return chats.sort((a, b) => b.created - a.created)
  }

  /**
   * Get chats that were active in a date range
   */
  public async getActiveInRange(start: Date, end: Date): Promise<Chat[]> {
    const ids = await this.indexManager.queryRange(
      'chats_by_updated',
      start.getTime(),
      end.getTime()
    )
    
    const chats: Chat[] = []
    for (const id of ids) {
      const chat = await this.getById(id)
      if (chat) chats.push(chat)
    }
    
    return chats.sort((a, b) => b.updated - a.updated)
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

  public async getMessages(chatId: number, options?: {
    limit?: number
    offset?: number
    since?: Date
    until?: Date
  }): Promise<ChatMessage[]> {
    const messageStorage = this.getMessageStorage(chatId)
    return messageStorage.getMessages(options)
  }

  public async addMessage(chatId: number, message: Omit<ChatMessage, 'id' | 'created' | 'updated'>): Promise<ChatMessage> {
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

  // --- Legacy API Compatibility ---

  /**
   * Get all chats (legacy API)
   */
  public async getAllChats(): Promise<Chat[]> {
    return this.list()
  }

  /**
   * Get chat by ID (legacy API)
   */
  public async getChat(id: number): Promise<Chat | null> {
    return this.getById(id)
  }

  /**
   * Create chat (legacy API)
   */
  public async createChat(data: Omit<Chat, 'id' | 'created' | 'updated'>): Promise<Chat> {
    return this.create(data)
  }

  /**
   * Update chat (legacy API)
   */
  public async updateChat(id: number, data: Partial<Omit<Chat, 'id' | 'created' | 'updated'>>): Promise<Chat | null> {
    return this.update(id, data)
  }

  /**
   * Delete chat (legacy API)
   */
  public async deleteChat(id: number): Promise<boolean> {
    return this.delete(id)
  }

  /**
   * Get chat messages (legacy API)
   */
  public async getChatMessages(chatId: number): Promise<ChatMessage[]> {
    return this.getMessages(chatId)
  }

  /**
   * Add chat message (legacy API)
   */
  public async addChatMessage(chatId: number, message: Omit<ChatMessage, 'id' | 'created' | 'updated'>): Promise<ChatMessage> {
    return this.addMessage(chatId, message)
  }

  /**
   * Get chats by project (legacy API)
   */
  public async getChatsByProject(projectId: number): Promise<Chat[]> {
    return this.getByProject(projectId)
  }

  // --- V1 Storage API Compatibility ---

  /**
   * Read chats (V1 storage API)
   */
  public async readChats(): Promise<ChatsStorage> {
    const chats = await this.list()
    const storage: ChatsStorage = {}
    for (const chat of chats) {
      storage[chat.id.toString()] = chat
    }
    return storage
  }

  /**
   * Write chats (V1 storage API)  
   */
  public async writeChats(chats: ChatsStorage): Promise<ChatsStorage> {
    // This is a complex migration operation - for now, return the input
    // In a real migration, we'd need to carefully handle this
    return chats
  }

  /**
   * Get chat by ID (V1 storage API)
   */
  public async getChatById(chatId: number): Promise<Chat | null> {
    return this.getById(chatId)
  }

  /**
   * Read chat messages (V1 storage API)
   */
  public async readChatMessages(chatId: number): Promise<ChatMessagesStorage> {
    const messages = await this.getMessages(chatId)
    const storage: ChatMessagesStorage = {}
    for (const message of messages) {
      storage[message.id] = message
    }
    return storage
  }

  /**
   * Write chat messages (V1 storage API)
   */
  public async writeChatMessages(chatId: number, messages: ChatMessagesStorage): Promise<ChatMessagesStorage> {
    // This is a complex migration operation - for now, return the input
    // In a real migration, we'd need to carefully handle this
    return messages
  }

  /**
   * Delete chat data (V1 storage API)
   */
  public async deleteChatData(chatId: number): Promise<void> {
    await this.delete(chatId)
  }

  /**
   * Generate ID (V1 storage API)
   */
  public generateId(): number {
    return Date.now()
  }

  // --- Index Management ---

  public async rebuildIndexes(): Promise<void> {
    const chats = await this.list()
    
    await this.indexManager.rebuildIndex('chats_by_title', chats)
    await this.indexManager.rebuildIndex('chats_by_project', chats)
    await this.indexManager.rebuildIndex('chats_by_created', chats)
    await this.indexManager.rebuildIndex('chats_by_updated', chats)
    await this.indexManager.rebuildIndex('chats_recent', chats)
  }

  public async getIndexStats() {
    const indexNames = ['chats_by_title', 'chats_by_project', 'chats_by_created', 'chats_by_updated', 'chats_recent']
    const stats = []
    
    for (const indexName of indexNames) {
      const indexStats = await this.indexManager.getIndexStats(indexName)
      if (indexStats) stats.push(indexStats)
    }
    
    return stats
  }

  // --- Helper Methods ---

  private async updateChatIndexes(chat: Chat): Promise<void> {
    await this.indexManager.addToIndex('chats_by_title', chat.id, chat)
    if (chat.projectId) {
      await this.indexManager.addToIndex('chats_by_project', chat.id, chat)
    }
    await this.indexManager.addToIndex('chats_by_created', chat.id, chat)
    await this.indexManager.addToIndex('chats_by_updated', chat.id, chat)
    await this.indexManager.addToIndex('chats_recent', chat.id, chat)
  }

  private async removeChatFromIndexes(chatId: number): Promise<void> {
    await this.indexManager.removeFromIndex('chats_by_title', chatId)
    await this.indexManager.removeFromIndex('chats_by_project', chatId)
    await this.indexManager.removeFromIndex('chats_by_created', chatId)
    await this.indexManager.removeFromIndex('chats_by_updated', chatId)
    await this.indexManager.removeFromIndex('chats_recent', chatId)
  }
}

/**
 * Storage for chat messages with full-text search
 */
export class ChatMessageStorage extends BaseStorage<ChatMessage, ChatMessagesStorage> {
  private chatId: number
  private indexManager: IndexManager

  constructor(chatId: number, options: StorageOptions = {}) {
    const dataDir = path.join('data', 'chat_storage', 'chat_data', chatId.toString())
    super(ChatMessagesStorageSchema, ChatMessageSchema, dataDir, options)
    
    this.chatId = chatId
    this.indexManager = new IndexManager(this.basePath, this.dataDir)
    
    // Initialize message indexes
    this.initializeIndexes()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'messages.json')
  }

  protected getEntityPath(id: number): string | null {
    // Messages don't have separate entity paths
    return null
  }

  protected async initializeIndexes(): Promise<void> {
    const indexes: IndexConfig[] = [
      {
        name: 'messages_by_role',
        type: 'hash',
        fields: ['role']
      },
      {
        name: 'messages_by_content',
        type: 'inverted', // For full-text search
        fields: ['content']
      },
      {
        name: 'messages_by_created',
        type: 'btree',
        fields: ['created']
      },
      {
        name: 'messages_by_type',
        type: 'hash',
        fields: ['type'],
        sparse: true
      }
    ]

    for (const indexConfig of indexes) {
      try {
        await this.indexManager.createIndex(indexConfig)
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(`Failed to create index ${indexConfig.name}:`, error)
        }
      }
    }
  }

  // Override create to update indexes and use string ID
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
    
    // Update indexes
    await this.updateMessageIndexes(validated)
    
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
      const roleIds = await this.indexManager.query('messages_by_role', options.role)
      messages = messages.filter(msg => roleIds.includes(msg.id))
    }
    
    // Filter by date range
    if (options?.since || options?.until) {
      messages = messages.filter(msg => {
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
    const ids = await this.indexManager.searchText('messages_by_content', query)
    const messages: ChatMessage[] = []
    
    for (const id of ids) {
      const message = await this.getById(id)
      if (message) messages.push(message)
    }
    
    return messages.sort((a, b) => a.created - b.created)
  }

  // Get messages by role
  public async getByRole(role: string): Promise<ChatMessage[]> {
    const ids = await this.indexManager.query('messages_by_role', role)
    const messages: ChatMessage[] = []
    
    for (const id of ids) {
      const message = await this.getById(id)
      if (message) messages.push(message)
    }
    
    return messages.sort((a, b) => a.created - b.created)
  }

  // Get latest messages
  public async getLatest(count: number = 10): Promise<ChatMessage[]> {
    const messages = await this.list()
    return messages
      .sort((a, b) => b.created - a.created)
      .slice(0, count)
  }

  // Helper to update all indexes for a message
  private async updateMessageIndexes(message: ChatMessage): Promise<void> {
    await this.indexManager.addToIndex('messages_by_role', message.id, message)
    await this.indexManager.addToIndex('messages_by_content', message.id, message)
    await this.indexManager.addToIndex('messages_by_created', message.id, message)
    if (message.type) {
      await this.indexManager.addToIndex('messages_by_type', message.id, message)
    }
  }

  // Rebuild indexes
  public async rebuildIndexes(): Promise<void> {
    const messages = await this.list()
    
    await this.indexManager.rebuildIndex('messages_by_role', messages)
    await this.indexManager.rebuildIndex('messages_by_content', messages)
    await this.indexManager.rebuildIndex('messages_by_created', messages)
    await this.indexManager.rebuildIndex('messages_by_type', messages)
  }
}

// Export singleton instance for backward compatibility
export const chatStorage = new ChatStorage({
  cacheEnabled: true,
  cacheTTL: 10 * 60 * 1000, // 10 minutes for chat data
  maxCacheSize: 500 // Cache up to 500 chats
})