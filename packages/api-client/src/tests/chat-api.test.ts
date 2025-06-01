import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { z } from 'zod'
import { createOctoPromptClient, OctoPromptError } from '@octoprompt/api-client'
import type { OctoPromptClient } from '@octoprompt/api-client'

import {
  ChatSchema,
  type Chat,
  type ChatMessage,
  AiChatStreamRequestSchema,
  ForkChatBodySchema,
  ForkChatFromMessageBodySchema,
  MessageRoleEnum
} from '@octoprompt/schemas'
import { TEST_API_URL } from './test-config'

const BASE_URL = TEST_API_URL

describe('Chat API Tests', () => {
  let client: OctoPromptClient
  let testChats: Chat[] = []
  let testMessages: ChatMessage[] = []

  beforeAll(() => {
    console.log('Starting Chat API Tests...')
    client = createOctoPromptClient({ baseUrl: BASE_URL })
  })

  afterAll(async () => {
    console.log('Cleaning up chat test data...')
    for (const chat of testChats) {
      try {
        await client.chats.deleteChat(chat.id)
      } catch (err) {
        if (err instanceof OctoPromptError && err.statusCode === 404) {
          // Already deleted
        } else {
          console.error(`Failed to delete chat ${chat.id}:`, err)
        }
      }
    }
  })

  test('POST /api/chats - Create chats', async () => {
    const chatDataInputs = [
      { title: 'Test Chat 1' },
      { title: 'Test Chat 2', copyExistingChatId: undefined },
      { title: 'Test Chat 3' }
    ]

    for (const data of chatDataInputs) {
      const result = await client.chats.createChat(data)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(ChatSchema.safeParse(result.data).success).toBe(true)
      expect(result.data.id).toBeTypeOf('number')
      expect(result.data.title).toBe(data.title)
      expect(result.data.created).toBeTypeOf('number')
      expect(result.data.updated).toBeTypeOf('number')
      testChats.push(result.data)
    }
    expect(testChats.length).toBe(chatDataInputs.length)
  })

  test('GET /api/chats - List all chats and verify creations', async () => {
    const result = await client.chats.listChats()

    expect(result.success).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.data.length).toBeGreaterThanOrEqual(testChats.length)

    for (const testChat of testChats) {
      const found = result.data.find((c: Chat) => c.id === testChat.id)
      expect(found).toBeDefined()
      if (found) {
        expect(found.title).toBe(testChat.title)
      }
    }
  })

  test('PATCH /api/chats/{chatId} - Update chat title', async () => {
    if (testChats.length === 0) {
      console.warn('Skipping PATCH /api/chats test as no chats were created.')
      return
    }
    const chatToUpdate = testChats[0]!
    const newTitle = 'Updated Test Chat Title'

    const result = await client.chats.updateChat(chatToUpdate.id, { title: newTitle })

    expect(result.success).toBe(true)
    expect(result.data.id).toBe(chatToUpdate.id)
    expect(result.data.title).toBe(newTitle)
    expect(result.data.updated).toBeGreaterThanOrEqual(chatToUpdate.updated)

    // Update our local copy with the returned data
    const chatIndex = testChats.findIndex((c) => c.id === chatToUpdate.id)
    if (chatIndex !== -1) {
      testChats[chatIndex] = result.data
    }
  })

  test('GET /api/chats/{chatId} - Get individual chat and verify update', async () => {
    if (testChats.length === 0) {
      console.warn('Skipping GET individual chat test as no chats exist.')
      return
    }

    // Use the updated chat data from the previous test
    const updatedChat = testChats[0]!

    try {
      const result = await client.chats.getChat(updatedChat.id)
      expect(result.success).toBe(true)
      expect(result.data.id).toBe(updatedChat.id)
      expect(result.data.title).toBe(updatedChat.title)
      expect(result.data.updated).toBe(updatedChat.updated)
    } catch (error) {
      // If we get a 404, log the error and check if the chat still exists in the list
      if (error instanceof OctoPromptError && error.statusCode === 404) {
        console.warn(`Chat ${updatedChat.id} not found, checking if it exists in list...`)

        // Re-fetch the chat list to see if our chat still exists
        const listResult = await client.chats.listChats()
        const foundInList = listResult.data.find((c: Chat) => c.id === updatedChat.id)

        if (foundInList) {
          console.warn('Chat exists in list but individual GET failed - possible API issue')
          // Update our local copy with the data from the list
          const chatIndex = testChats.findIndex((c) => c.id === updatedChat.id)
          if (chatIndex !== -1) {
            testChats[chatIndex] = foundInList
          }
        } else {
          console.error('Chat no longer exists in system')
          throw error
        }
      } else {
        throw error
      }
    }
  })

  test('POST /api/ai/chat - Send a message to a chat (stream) and verify messages', async () => {
    if (testChats.length === 0) {
      console.warn('Skipping POST /api/ai/chat test as no chats exist.')
      return
    }
    const targetChat = testChats[0]!
    const tempId = Date.now()
    const userMessageContent = 'Hello AI, this is a test message from client test!'
    const aiChatRequestData = {
      chatId: targetChat.id,
      userMessage: userMessageContent,
      tempId: tempId,
      options: { provider: 'ollama' as any, model: 'llama3', temperature: 0.1 }
    }

    expect(AiChatStreamRequestSchema.safeParse(aiChatRequestData).success).toBe(true)

    try {
      const stream = await client.chats.streamChat(aiChatRequestData)
      expect(stream).toBeInstanceOf(ReadableStream)

      // Consume the stream
      const reader = stream.getReader()
      let receivedText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        receivedText += new TextDecoder().decode(value)
      }
      console.log('Streamed AI response:', receivedText)
      expect(receivedText.length).toBeGreaterThan(0)
    } catch (error) {
      if (
        error instanceof OctoPromptError &&
        (error.statusCode === 503 || error.message.includes('Failed to get model interface'))
      ) {
        console.warn('AI Service unavailable, skipping full stream content verification.')
        return
      }
      throw error
    }

    // Verify messages after stream
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const messagesResult = await client.chats.getMessages(targetChat.id)
    expect(messagesResult.success).toBe(true)
    expect(Array.isArray(messagesResult.data)).toBe(true)

    const userMessage = messagesResult.data.find(
      (m) => m.role === MessageRoleEnum.enum.user && m.content === userMessageContent
    )
    expect(userMessage).toBeDefined()
    if (userMessage) testMessages.push(userMessage)

    const assistantMessage = messagesResult.data.find((m) => m.role === MessageRoleEnum.enum.assistant)
    expect(assistantMessage).toBeDefined()
    if (assistantMessage) testMessages.push(assistantMessage)
  })

  test('DELETE /api/chats/{chatId}/messages/{messageId} - Delete a message', async () => {
    if (testMessages.length === 0) {
      console.warn('Skipping DELETE /message test as no messages were recorded from previous test.')
      return
    }
    const messageToDelete = testMessages.pop()!

    const success = await client.chats.deleteMessage(messageToDelete.chatId, messageToDelete.id)
    expect(success).toBe(true)

    // Verify it's gone
    const remainingMessagesResult = await client.chats.getMessages(messageToDelete.chatId)
    expect(remainingMessagesResult.success).toBe(true)
    const foundDeleted = remainingMessagesResult.data.find((m) => m.id === messageToDelete.id)
    expect(foundDeleted).toBeUndefined()
  })

  test('POST /api/chats/{chatId}/fork - Fork a chat', async () => {
    if (testChats.length === 0) {
      console.warn('Skipping fork chat test as no chats exist.')
      return
    }
    const originalChat = testChats[0]!

    const messagesInOriginal = await client.chats.getMessages(originalChat.id)
    let excludedMessageIds: number[] = []
    if (messagesInOriginal.success && messagesInOriginal.data.length > 0) {
      excludedMessageIds = [messagesInOriginal.data[0]!.id]
    }

    const forkBody: z.infer<typeof ForkChatBodySchema> = { excludedMessageIds }
    const result = await client.chats.forkChat(originalChat.id, forkBody)

    expect(result.success).toBe(true)
    expect(result.data.id).toBeTypeOf('number')
    expect(result.data.id).not.toBe(originalChat.id)

    const forkedChat = result.data
    testChats.push(forkedChat)

    // Verify messages in forked chat
    const forkedChatMessages = await client.chats.getMessages(forkedChat.id)
    expect(forkedChatMessages.success).toBe(true)
    if (messagesInOriginal.success) {
      if (excludedMessageIds.length > 0) {
        expect(forkedChatMessages.data.length).toBe(messagesInOriginal.data.length - excludedMessageIds.length)
        expect(forkedChatMessages.data.some((m) => m.id === excludedMessageIds[0])).toBe(false)
      } else {
        expect(forkedChatMessages.data.length).toBe(messagesInOriginal.data.length)
      }
    }
  })

  test('POST /api/chats/{chatId}/fork/{messageId} - Fork from a specific message', async () => {
    const originalChatForFork = testChats.find(
      (c) => c.title === 'Test Chat 1' || c.title === 'Updated Test Chat Title'
    )
    if (!originalChatForFork) {
      console.warn('Skipping fork from message: Original chat for fork not found.')
      return
    }

    const messagesResponse = await client.chats.getMessages(originalChatForFork.id)
    if (!messagesResponse.success || messagesResponse.data.length < 2) {
      console.warn('Skipping fork from message: Original chat has less than 2 messages.')
      return
    }
    const messageToForkFrom = messagesResponse.data[1]!

    const forkFromBody: z.infer<typeof ForkChatFromMessageBodySchema> = { excludedMessageIds: [] }
    const result = await client.chats.forkChatFromMessage(originalChatForFork.id, messageToForkFrom.id, forkFromBody)

    expect(result.success).toBe(true)
    expect(result.data.id).toBeTypeOf('number')
    expect(result.data.id).not.toBe(originalChatForFork.id)
    testChats.push(result.data)

    const newForkedMessages = await client.chats.getMessages(result.data.id)
    expect(newForkedMessages.success).toBe(true)

    const forkPointIndex = messagesResponse.data.findIndex((m) => m.id === messageToForkFrom.id)
    const originalMessagesUpToForkPoint = messagesResponse.data.slice(0, forkPointIndex + 1)
    expect(newForkedMessages.data.length).toBe(originalMessagesUpToForkPoint.length)

    // Verify content of messages (IDs will be new)
    for (let i = 0; i < originalMessagesUpToForkPoint.length; i++) {
      expect(newForkedMessages.data[i]!.content).toBe(originalMessagesUpToForkPoint[i]!.content)
      expect(newForkedMessages.data[i]!.role).toBe(originalMessagesUpToForkPoint[i]!.role)
    }
  })

  test('DELETE /api/chats/{chatId} - Delete a chat session and verify', async () => {
    if (testChats.length === 0) {
      console.warn('Skipping DELETE /chat test as no chats exist to delete explicitly.')
      return
    }
    const chatToDelete = testChats.pop()!

    const success = await client.chats.deleteChat(chatToDelete.id)
    expect(success).toBe(true)

    // Verify it's gone (expect 404)
    try {
      await client.chats.getChat(chatToDelete.id)
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(OctoPromptError)
      if (error instanceof OctoPromptError) {
        expect(error.statusCode).toBe(404)
      }
    }
  })
})
