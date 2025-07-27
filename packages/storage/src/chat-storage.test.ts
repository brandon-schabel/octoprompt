import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { chatStorage } from './chat-storage'
import { type Chat, type ChatMessage } from '@promptliano/schemas'
import { DatabaseManager } from './database-manager'

describe('Chat Storage (SQLite)', () => {
  let testChatId: number
  let testMessageId: number

  beforeEach(async () => {
    // Get database instance and clear tables
    const db = DatabaseManager.getInstance()
    await db.clearAllTables()

    testChatId = Date.now()
    testMessageId = testChatId + 1
  })

  afterEach(async () => {
    // Clear all tables for next test
    const db = DatabaseManager.getInstance()
    await db.clearAllTables()
  })

  it('should create and read a chat', async () => {
    const testChat: Chat = {
      id: testChatId,
      title: 'Test Chat',
      created: testChatId,
      updated: testChatId
    }

    // Write chat
    const chats = await chatStorage.readChats()
    chats[String(testChatId)] = testChat
    await chatStorage.writeChats(chats)

    // Read chat by ID
    const retrievedChat = await chatStorage.getChatById(testChatId)
    expect(retrievedChat).toEqual(testChat)
  })

  it('should create and read chat messages', async () => {
    const testMessage: ChatMessage = {
      id: testMessageId,
      chatId: testChatId,
      role: 'user',
      content: 'Test message content',
      created: testMessageId,
      updated: testMessageId
    }

    // Write message
    const messages = { [String(testMessageId)]: testMessage }
    await chatStorage.writeChatMessages(testChatId, messages)

    // Read messages
    const retrievedMessages = await chatStorage.readChatMessages(testChatId)
    expect(retrievedMessages).toEqual(messages)
  })

  it('should handle transactions correctly', async () => {
    const testChat: Chat = {
      id: testChatId,
      title: 'Transaction Test Chat',
      created: testChatId,
      updated: testChatId
    }

    const testMessage1: ChatMessage = {
      id: testMessageId,
      chatId: testChatId,
      role: 'user',
      content: 'First message',
      created: testMessageId,
      updated: testMessageId
    }

    const testMessage2: ChatMessage = {
      id: testMessageId + 1,
      chatId: testChatId,
      role: 'assistant',
      content: 'Second message',
      created: testMessageId + 1,
      updated: testMessageId + 1
    }

    // Create chat
    const chats = await chatStorage.readChats()
    chats[String(testChatId)] = testChat
    await chatStorage.writeChats(chats)

    // Add messages
    await chatStorage.addMessage(testMessage1)
    await chatStorage.addMessage(testMessage2)

    // Verify messages were added
    const messages = await chatStorage.readChatMessages(testChatId)
    expect(Object.keys(messages).length).toBe(2)

    // Delete chat and verify cascade delete
    await chatStorage.deleteChatData(testChatId)

    // Verify chat is deleted
    const deletedChat = await chatStorage.getChatById(testChatId)
    expect(deletedChat).toBeNull()

    // Verify messages are deleted
    const deletedMessages = await chatStorage.readChatMessages(testChatId)
    expect(Object.keys(deletedMessages).length).toBe(0)
  })

  it('should find chats by date range', async () => {
    const now = Date.now()
    const testChat: Chat = {
      id: testChatId,
      title: 'Date Range Test',
      created: testChatId,
      updated: testChatId
    }

    // Create chat
    const chats = await chatStorage.readChats()
    chats[String(testChatId)] = testChat
    await chatStorage.writeChats(chats)

    // Find by date range
    const foundChats = await chatStorage.findChatsByDateRange(now - 1000, now + 1000)
    expect(foundChats.length).toBeGreaterThan(0)
    expect(foundChats.some((chat) => chat.id === testChatId)).toBe(true)
  })

  it('should count messages for a chat', async () => {
    // Add multiple messages
    for (let i = 0; i < 5; i++) {
      const message: ChatMessage = {
        id: testMessageId + i,
        chatId: testChatId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        created: testMessageId + i,
        updated: testMessageId + i
      }
      await chatStorage.addMessage(message)
    }

    // Count messages
    const count = await chatStorage.countMessagesForChat(testChatId)
    expect(count).toBe(5)
  })

  it('should update a message', async () => {
    const testMessage: ChatMessage = {
      id: testMessageId,
      chatId: testChatId,
      role: 'user',
      content: 'Original content',
      created: testMessageId,
      updated: testMessageId
    }

    // Add message
    await chatStorage.addMessage(testMessage)

    // Update message
    const updatedMessage: ChatMessage = {
      ...testMessage,
      content: 'Updated content'
    }
    const updated = await chatStorage.updateMessage(testMessageId, updatedMessage)
    expect(updated).toBe(true)

    // Verify update
    const retrievedMessage = await chatStorage.getMessageById(testMessageId)
    expect(retrievedMessage?.content).toBe('Updated content')
  })

  it('should delete a single message', async () => {
    const testMessage: ChatMessage = {
      id: testMessageId,
      chatId: testChatId,
      role: 'user',
      content: 'To be deleted',
      created: testMessageId,
      updated: testMessageId
    }

    // Add message
    await chatStorage.addMessage(testMessage)

    // Delete message
    const deleted = await chatStorage.deleteMessage(testMessageId)
    expect(deleted).toBe(true)

    // Verify deletion
    const retrievedMessage = await chatStorage.getMessageById(testMessageId)
    expect(retrievedMessage).toBeNull()
  })
})
