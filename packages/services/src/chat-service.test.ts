import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { createChatService } from '@octoprompt/services'
import { randomString } from '@octoprompt/shared/src/utils/test-utils'
import { normalizeToUnixMs } from '@octoprompt/shared'
import type { ChatsStorage, ChatMessagesStorage } from '@octoprompt/storage'

// Use realistic unix timestamps for test IDs
const BASE_TIMESTAMP = 1700000000000 // Nov 2023 as base
let mockIdCounter = BASE_TIMESTAMP + 100000 // Start with a high offset for chat/message IDs

const generateTestId = () => {
  mockIdCounter += 1000 // Increment by 1000 for next ID
  return mockIdCounter
}

// In-memory stores for our mocks
let mockChatsDb: ChatsStorage = {}
let mockChatMessagesDb: Record<number, ChatMessagesStorage> = {} // ChatId -> Messages

// Mock the chatStorage utility with V2 API
const mockChatStorage = {
  // V2 API methods
  create: async (data: { title: string }) => {
    const id = generateTestId()
    const now = normalizeToUnixMs(new Date())
    const newChat = {
      id,
      title: data.title,
      created: now,
      updated: now
    }
    mockChatsDb[id] = newChat
    mockChatMessagesDb[id] = {} // Initialize empty messages
    return newChat
  },
  update: async (id: number, data: { title?: string }) => {
    const existing = mockChatsDb[id]
    if (!existing) return null
    const updated = {
      ...existing,
      ...data,
      updated: normalizeToUnixMs(new Date())
    }
    mockChatsDb[id] = updated
    return updated
  },
  delete: async (id: number) => {
    if (!mockChatsDb[id]) return false
    delete mockChatsDb[id]
    delete mockChatMessagesDb[id]
    return true
  },
  getById: async (id: number) => {
    return mockChatsDb[id] || null
  },
  list: async () => {
    return Object.values(mockChatsDb)
  },
  getMessages: async (chatId: number) => {
    const messages = mockChatMessagesDb[chatId] || {}
    return Object.values(messages)
  },
  addMessage: async (chatId: number, data: any) => {
    if (!mockChatsDb[chatId]) {
      throw new Error(`Chat ${chatId} not found`)
    }
    const messageId = generateTestId()
    const now = normalizeToUnixMs(new Date())
    const message = {
      ...data,
      id: messageId,
      chatId,
      created: data.created || now,
      updated: now
    }
    if (!mockChatMessagesDb[chatId]) {
      mockChatMessagesDb[chatId] = {}
    }
    mockChatMessagesDb[chatId][messageId] = message
    return message
  },
  getMessageById: async (chatId: number, messageId: number) => {
    const messages = mockChatMessagesDb[chatId] || {}
    return messages[messageId] || null
  },
  getMessageStorage: (chatId: number) => ({
    writeAll: async (messages: ChatMessagesStorage) => {
      mockChatMessagesDb[chatId] = JSON.parse(JSON.stringify(messages))
      return messages
    }
  }),
  // Legacy compatibility methods (these map to V2 methods)
  createChat: async function(data: { title: string }) {
    return this.create(data)
  },
  updateChat: async function(id: number, data: { title?: string }) {
    return this.update(id, data)
  },
  deleteChat: async function(id: number) {
    return this.delete(id)
  },
  getChat: async function(id: number) {
    return this.getById(id)
  },
  getAllChats: async function() {
    return this.list()
  },
  getChatMessages: async function(chatId: number) {
    return this.getMessages(chatId)
  },
  addChatMessage: async function(chatId: number, data: any) {
    return this.addMessage(chatId, data)
  },
  // Keep V1 compatibility methods for any code that might still use them
  readChats: async () => JSON.parse(JSON.stringify(mockChatsDb)),
  writeChats: async (data: ChatsStorage) => {
    mockChatsDb = JSON.parse(JSON.stringify(data))
    return mockChatsDb
  },
  readChatMessages: async (chatId: number) => {
    return JSON.parse(JSON.stringify(mockChatMessagesDb[chatId] || {}))
  },
  writeChatMessages: async (chatId: number, data: ChatMessagesStorage) => {
    mockChatMessagesDb[chatId] = JSON.parse(JSON.stringify(data))
    return mockChatMessagesDb[chatId]
  },
  deleteChatData: async (chatId: number) => {
    delete mockChatMessagesDb[chatId]
  },
  generateId: () => generateTestId(),
  getChatById: async (chatId: number) => {
    return mockChatsDb[chatId] || null
  }
}

mock.module('@octoprompt/storage', () => ({
  chatStorage: mockChatStorage
}))

let chatService: ReturnType<typeof createChatService>

describe('Chat Service (Mocked Storage)', () => {
  beforeEach(async () => {
    mockChatsDb = {}
    mockChatMessagesDb = {}
    mockIdCounter = BASE_TIMESTAMP + 100000 // Reset base ID for each test
    chatService = createChatService()
  })

  test('createChat should insert a new chat record', async () => {
    const title = `Chat_${randomString()}`
    const chat = await chatService.createChat(title)
    expect(chat.id).toBeDefined()
    expect(typeof chat.id).toBe('number')
    expect(chat.title).toBe(title)
    expect(chat.created).toBeDefined()
    expect(typeof chat.created).toBe('number')
    expect(chat.updated).toBeDefined()
    expect(typeof chat.updated).toBe('number')

    // Verify by trying to get it via the service
    const allChats = await chatService.getAllChats()
    const foundChat = allChats.find((c) => c.id === chat.id)
    expect(foundChat).toBeDefined()
    expect(foundChat?.title).toBe(title)
    expect(mockChatsDb[chat.id]).toEqual(chat)
    expect(mockChatMessagesDb[chat.id]).toEqual({})
  })

  test('createChat with copyExisting copies messages from another chat', async () => {
    const source = await chatService.createChat('SourceChat')
    const now = Date.now()
    // Insert two messages
    await chatService.saveMessage({
      chatId: source.id,
      role: 'system',
      content: 'Hello',
      id: generateTestId(),
      created: normalizeToUnixMs(now - 1000)
    })
    await chatService.saveMessage({
      chatId: source.id,
      role: 'user',
      content: 'World',
      id: generateTestId(),
      created: normalizeToUnixMs(now - 500)
    })

    const newChat = await chatService.createChat('CopyTarget', {
      copyExisting: true,
      currentChatId: source.id
    })

    expect(newChat.id).toBeDefined()

    // Check that new chat has the same 2 messages (content-wise)
    const newMessages = await chatService.getChatMessages(newChat.id)
    expect(newMessages.length).toBe(2)
    // Note: Message IDs will be different in the new chat. Order should be preserved.
    const originalMessages = await chatService.getChatMessages(source.id)
    expect(newMessages[0].content).toBe(originalMessages[0].content) // Hello
    expect(newMessages[0].role).toBe(originalMessages[0].role)
    expect(newMessages[1].content).toBe(originalMessages[1].content) // World
    expect(newMessages[1].role).toBe(originalMessages[1].role)

    // Also verify that message IDs are different
    expect(newMessages[0].id).not.toBe(originalMessages[0].id)
    expect(newMessages[1].id).not.toBe(originalMessages[1].id)
    expect(newMessages[0].chatId).toBe(newChat.id)
  })

  test('saveMessage inserts a new message', async () => {
    const chat = await chatService.createChat('MessageTest')
    const msgData = {
      chatId: chat.id,
      role: 'user' as const,
      content: 'Sample content',
      id: generateTestId(), // Use generated ID
      created: normalizeToUnixMs(Date.now()) // Ensure Unix ms timestamp
    }
    const msg = await chatService.saveMessage(msgData)
    expect(msg.id).toBeDefined()
    expect(typeof msg.id).toBe('number')
    expect(msg.chatId).toBe(chat.id)
    expect(msg.role).toBe(msgData.role)
    expect(msg.content).toBe(msgData.content)
    expect(msg.created).toBeDefined()
    expect(typeof msg.created).toBe('number')

    // Verify by getting messages for the chat
    const messages = await chatService.getChatMessages(chat.id)
    expect(messages.length).toBe(1)
    expect(messages[0].id).toBe(msg.id)
    expect(messages[0].content).toBe('Sample content')
    expect(mockChatMessagesDb[chat.id][msg.id]).toEqual(
      expect.objectContaining({
        id: msg.id,
        content: 'Sample content'
      })
    )
  })

  test('updateMessageContent changes content of a message', async () => {
    const chat = await chatService.createChat('UpdateMsg')
    const msg = await chatService.saveMessage({
      chatId: chat.id,
      role: 'user' as const,
      content: 'Old content',
      id: generateTestId(), // Use generated ID
      created: normalizeToUnixMs(Date.now()) // Ensure Unix ms timestamp
    })

    await chatService.updateMessageContent(chat.id, msg.id, 'New content')

    const messages = await chatService.getChatMessages(chat.id)
    expect(messages.length).toBe(1)
    expect(messages[0].id).toBe(msg.id)
    expect(messages[0].content).toBe('New content')
    expect(mockChatMessagesDb[chat.id][msg.id].content).toBe('New content')
  })

  test('getAllChats returns all chats sorted by updated', async () => {
    const chatA = await chatService.createChat('ChatA') // Will have earliest updated
    await new Promise((resolve) => setTimeout(resolve, 10)) // Ensure timestamp difference
    const chatB = await chatService.createChat('ChatB')
    await new Promise((resolve) => setTimeout(resolve, 10))
    const chatC = await chatService.createChat('ChatC') // Will have latest updated

    // Update chatA to make its updated more recent than B but less than C for a better sort test
    await new Promise((resolve) => setTimeout(resolve, 10))
    await chatService.updateChat(chatA.id, 'ChatA Updated')

    const chats = await chatService.getAllChats()
    expect(chats.length).toBe(3)
    // Sorted by updated DESC. The updated chatA should be first, then C, then B.
    expect(chats[0].title).toBe('ChatA Updated')
    expect(Object.keys(mockChatsDb).length).toBe(3)
  })

  test('updateChat changes the chat title and updates timestamp', async () => {
    const chat = await chatService.createChat('InitialTitle')
    const originalUpdated = chat.updated
    await new Promise((resolve) => setTimeout(resolve, 10)) // Ensure time passes

    const updated = await chatService.updateChat(chat.id, 'NewTitle')
    expect(updated.title).toBe('NewTitle')
    expect(updated.id).toBe(chat.id)
    expect(new Date(updated.updated).getTime()).toBeGreaterThan(new Date(originalUpdated).getTime())

    const allChats = await chatService.getAllChats()
    const foundChat = allChats.find((c) => c.id === chat.id)
    expect(foundChat?.title).toBe('NewTitle')
    expect(mockChatsDb[chat.id].title).toBe('NewTitle')
  })

  test('deleteChat removes chat and its messages', async () => {
    const chat = await chatService.createChat('DeleteMe')
    const now = Date.now()
    await chatService.saveMessage({
      chatId: chat.id,
      role: 'user' as const,
      content: 'Hello',
      id: generateTestId(),
      created: normalizeToUnixMs(now - 100)
    })
    await chatService.saveMessage({
      chatId: chat.id,
      role: 'assistant' as const,
      content: 'World',
      id: generateTestId(),
      created: normalizeToUnixMs(now)
    })

    await chatService.deleteChat(chat.id)

    // Ensure chat is gone
    const allChats = await chatService.getAllChats()
    expect(allChats.find((c) => c.id === chat.id)).toBeUndefined()
    expect(mockChatsDb[chat.id]).toBeUndefined()

    // Ensure messages are gone
    await expect(chatService.getChatMessages(chat.id)).rejects.toThrow(new Error(`Chat with ID ${chat.id} not found.`))
    expect(mockChatMessagesDb[chat.id]).toBeUndefined()
  })

  test('deleteMessage removes only that message', async () => {
    const chat = await chatService.createChat('MsgDelete')
    const now = Date.now()
    const m1 = await chatService.saveMessage({
      chatId: chat.id,
      role: 'user' as const,
      content: 'First',
      id: generateTestId(),
      created: normalizeToUnixMs(now - 100)
    })
    const m2 = await chatService.saveMessage({
      chatId: chat.id,
      role: 'assistant' as const,
      content: 'Second',
      id: generateTestId(),
      created: normalizeToUnixMs(now)
    })

    await chatService.deleteMessage(chat.id, m1.id)

    const all = await chatService.getChatMessages(chat.id)
    expect(all.length).toBe(1)
    expect(all[0].id).toBe(m2.id)
    expect(mockChatMessagesDb[chat.id][m1.id]).toBeUndefined()
    expect(mockChatMessagesDb[chat.id][m2.id]).toBeDefined()
  })

  test('forkChat duplicates chat and messages except excluded IDs', async () => {
    const source = await chatService.createChat('SourceFork')
    const now = Date.now()
    const msgA = await chatService.saveMessage({
      chatId: source.id,
      role: 'user' as const,
      content: 'A',
      id: generateTestId(),
      created: normalizeToUnixMs(now - 200)
    })
    const msgB = await chatService.saveMessage({
      chatId: source.id,
      role: 'assistant' as const,
      content: 'B',
      id: generateTestId(),
      created: normalizeToUnixMs(now - 100)
    })
    const msgC = await chatService.saveMessage({
      chatId: source.id,
      role: 'user' as const,
      content: 'C',
      id: generateTestId(),
      created: normalizeToUnixMs(now)
    })

    const newChat = await chatService.forkChat(source.id, [msgB.id]) // Exclude original msgB.id
    const newMessages = await chatService.getChatMessages(newChat.id)

    expect(newMessages.length).toBe(2) // A and C copied with new IDs
    const contents = newMessages.map((m) => m.content).sort()
    expect(contents).toEqual(['A', 'C'])

    // Verify new message IDs
    const originalMessageIds = [msgA.id, msgC.id]
    newMessages.forEach((nm) => {
      expect(originalMessageIds).not.toContain(nm.id) // New IDs
      expect(nm.chatId).toBe(newChat.id)
    })
    expect(mockChatsDb[newChat.id]).toBeDefined()
    expect(Object.keys(mockChatMessagesDb[newChat.id]).length).toBe(2)
  })

  test('forkChatFromMessage only copies messages up to a given message, excluding any if needed', async () => {
    const source = await chatService.createChat('ForkFromMsg')
    const now = Date.now()
    const msg1 = await chatService.saveMessage({
      chatId: source.id,
      role: 'user' as const,
      content: 'Msg1',
      id: generateTestId(),
      created: normalizeToUnixMs(now - 200)
    })
    await new Promise((resolve) => setTimeout(resolve, 1)) // ensure order
    const msg2 = await chatService.saveMessage({
      chatId: source.id,
      role: 'assistant' as const,
      content: 'Msg2',
      id: generateTestId(),
      created: normalizeToUnixMs(now - 100)
    })
    await new Promise((resolve) => setTimeout(resolve, 1))
    const msg3 = await chatService.saveMessage({
      chatId: source.id,
      role: 'user' as const,
      content: 'Msg3',
      id: generateTestId(),
      created: normalizeToUnixMs(now)
    })

    // Fork from original msg2, exclude original msg1
    const newChat = await chatService.forkChatFromMessage(source.id, msg2.id, [msg1.id])
    const newMsgs = await chatService.getChatMessages(newChat.id)

    // Should include only a copy of msg2 (msg1 excluded, msg3 after fork point)
    expect(newMsgs.length).toBe(1)
    expect(newMsgs[0].content).toBe('Msg2') // Content of msg2
    expect(newMsgs[0].id).not.toBe(msg2.id) // New ID
    expect(newMsgs[0].chatId).toBe(newChat.id)
    expect(mockChatsDb[newChat.id]).toBeDefined()
    expect(Object.keys(mockChatMessagesDb[newChat.id]).length).toBe(1)
  })
})
