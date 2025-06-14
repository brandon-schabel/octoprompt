import {
  ChatSchema,
  ChatMessageSchema,
  type ChatMessage,
  type Chat,
  type ExtendedChatMessage
} from '@octoprompt/schemas'
import { ApiError, normalizeToUnixMs } from '@octoprompt/shared'
import { chatStorage, type ChatMessagesStorage } from '@octoprompt/storage'
import { safeAsync, throwNotFound, handleValidationError } from './utils/error-handlers'

export type CreateChatOptions = {
  copyExisting?: boolean
  currentChatId?: number
}
/**
 * Returns an object of functions handling chat logic in a functional style
 * using JSON file storage.
 */
export function createChatService() {
  async function createChat(title: string, options?: CreateChatOptions): Promise<Chat> {
    return safeAsync(
      async () => {
        // Validate the copy source exists if copying
        if (options?.copyExisting && options?.currentChatId) {
          const sourceChat = await chatStorage.getChat(options.currentChatId)
          if (!sourceChat) {
            throw new ApiError(
              404,
              `Referenced chat with ID ${options.currentChatId} not found for copying.`,
              'REFERENCED_CHAT_NOT_FOUND'
            )
          }
        }

        // Create the chat using V2 API
        const newChat = await chatStorage.createChat({ title })

        // Copy messages if requested
        if (options?.copyExisting && options?.currentChatId) {
          const sourceMessages = await chatStorage.getChatMessages(options.currentChatId)

          for (const msg of sourceMessages) {
            // Create a copy of the message in the new chat
            const copiedMsg = {
              ...msg,
              chatId: newChat.id
            }
            // Remove id and timestamps so they get regenerated
            const { id, created, updated, ...messageData } = copiedMsg

            try {
              await chatStorage.addMessage(newChat.id, messageData)
            } catch (error) {
              console.error(`Failed to copy message ${msg.id} to new chat ${newChat.id}:`, error)
              // Continue with next message on error
            }
          }
        }

        return newChat
      },
      {
        entityName: 'chat',
        action: 'creating',
        details: { title, options }
      }
    )
  }

  async function updateChatTimestamp(chatId: number): Promise<void> {
    const chat = await chatStorage.getById(chatId)
    if (!chat) {
      throwNotFound('Chat', chatId)
    }

    // The updateChat method will automatically update the timestamp
    const updated = await chatStorage.update(chatId, {})
    if (!updated) {
      throw new ApiError(500, `Failed to update chat timestamp for ${chatId}.`, 'CHAT_UPDATE_FAILED')
    }
  }

  async function saveMessage(message: ExtendedChatMessage): Promise<ExtendedChatMessage> {
    return safeAsync(
      async () => {
        // Check chat exists
        const chat = await chatStorage.getChat(message.chatId)
        if (!chat) {
          throw new ApiError(
            404,
            `Chat with ID ${message.chatId} not found. Cannot save message.`,
            'CHAT_NOT_FOUND_FOR_MESSAGE'
          )
        }

        const messageData = {
          chatId: message.chatId,
          role: message.role,
          content: message.content,
          attachments: message.attachments
        }

        // If an ID is provided and a message with that ID exists, we should update instead of create
        if (message.id) {
          const existingMessage = await chatStorage.getMessageById(message.chatId, message.id)
          if (existingMessage) {
            console.warn(`Message with ID ${message.id} already exists in chat ${message.chatId}. Overwriting.`)
            // For now, delete and recreate since we don't have an updateMessage method
            // This is not ideal but maintains current behavior
            const messages = await chatStorage.getChatMessages(message.chatId)
            const messageToUpdate = messages.find((m) => m.id === message.id)
            if (messageToUpdate) {
              // Preserve creation time when updating
              const updatedMessageData = {
                ...messageData,
                created: message.created || messageToUpdate.created
              }
              // We need to implement a proper update method in storage
              // For now, we'll use the add method which might create a new ID
            }
          }
        }

        const savedMessage = await chatStorage.addMessage(message.chatId, messageData)
        await updateChatTimestamp(message.chatId)

        return { ...savedMessage, tempId: message.tempId }
      },
      {
        entityName: 'message',
        action: 'saving',
        details: { chatId: message.chatId, role: message.role }
      }
    )
  }

  async function updateMessageContent(chatId: number, messageId: number, content: string): Promise<void> {
    return safeAsync(
      async () => {
        // Check chat exists
        const chat = await chatStorage.getById(chatId)
        if (!chat) {
          throwNotFound('Chat', chatId)
        }

        // Get the specific message
        const message = await chatStorage.getMessageById(chatId, messageId)
        if (!message) {
          throw new ApiError(
            404,
            `Message with ID ${messageId} not found in chat ${chatId} for update.`,
            'MESSAGE_NOT_FOUND'
          )
        }

        // Since we don't have a direct updateMessage method in storage,
        // we need to work around this limitation
        // For now, we'll read all messages, update the one we want, and write them back
        // This is not ideal and should be fixed when we add updateMessage to storage
        const messages = await chatStorage.getChatMessages(chatId)
        const messageIndex = messages.findIndex((m) => m.id === messageId)

        if (messageIndex === -1) {
          throw new ApiError(500, `Message found but not in messages list`, 'MESSAGE_INCONSISTENCY')
        }

        // Update the content
        messages[messageIndex].content = content
        messages[messageIndex].updated = normalizeToUnixMs(new Date())

        // Validate the updated message
        ChatMessageSchema.parse(messages[messageIndex])

        // Write back all messages - this is temporary until we have updateMessage
        const messageStorage = chatStorage.getMessageStorage(chatId)
        const messagesObj: ChatMessagesStorage = {}
        messages.forEach((msg) => {
          messagesObj[msg.id] = msg
        })
        await messageStorage.writeAll(messagesObj)

        await updateChatTimestamp(chatId)
      },
      {
        entityName: 'message',
        action: 'updating',
        details: { chatId, messageId }
      }
    )
  }

  async function getAllChats(): Promise<Chat[]> {
    const chats = await chatStorage.list()
    chats.sort((a, b) => b.updated - a.updated) // Sort by most recently updated
    return chats
  }

  async function getChatMessages(chatId: number): Promise<ChatMessage[]> {
    const chat = await chatStorage.getById(chatId)
    if (!chat) {
      throw new ApiError(404, `Chat with ID ${chatId} not found.`, 'CHAT_NOT_FOUND')
    }

    const messages = await chatStorage.getChatMessages(chatId)
    messages.sort((a, b) => a.created - b.created) // Sort by creation time
    return messages
  }

  async function updateChat(chatId: number, title: string): Promise<Chat> {
    return safeAsync(
      async () => {
        const updatedChat = await chatStorage.update(chatId, { title })
        if (!updatedChat) {
          throwNotFound('Chat', chatId)
        }
        return updatedChat
      },
      {
        entityName: 'chat',
        action: 'updating',
        details: { chatId, title }
      }
    )
  }

  async function deleteChat(chatId: number): Promise<void> {
    const deleted = await chatStorage.delete(chatId)
    if (!deleted) {
      throwNotFound('Chat', chatId)
    }
  }

  async function deleteMessage(chatId: number, messageId: number): Promise<void> {
    const chat = await chatStorage.getById(chatId)
    if (!chat) {
      throwNotFound('Chat', chatId)
    }

    // Get message to verify it exists
    const message = await chatStorage.getMessageById(chatId, messageId)
    if (!message) {
      throw new ApiError(
        404,
        `Message with ID ${messageId} not found in chat ${chatId} for deletion.`,
        'MESSAGE_NOT_FOUND'
      )
    }

    // Since we don't have a deleteMessage method in storage, we need to work around
    // Get all messages, filter out the one to delete, and write back
    const messages = await chatStorage.getChatMessages(chatId)
    const filteredMessages = messages.filter((m) => m.id !== messageId)

    const messageStorage = chatStorage.getMessageStorage(chatId)
    const messagesObj: ChatMessagesStorage = {}
    filteredMessages.forEach((msg) => {
      messagesObj[msg.id] = msg
    })
    await messageStorage.writeAll(messagesObj)

    await updateChatTimestamp(chatId)
  }

  async function forkChat(sourceChatId: number, excludedMessageIds: number[] = []): Promise<Chat> {
    const sourceChat = await chatStorage.getChat(sourceChatId)
    if (!sourceChat) {
      throwNotFound('Source chat', sourceChatId)
    }

    const newTitle = `Fork of ${sourceChat.title} (${new Date().toLocaleTimeString()})`

    // Create the new chat
    const newChat = await chatStorage.createChat({ title: newTitle })

    // Copy messages
    const sourceMessages = await chatStorage.getChatMessages(sourceChatId)

    for (const msg of sourceMessages) {
      if (!excludedMessageIds.includes(msg.id)) {
        // Copy the message to the new chat
        const { id, created, updated, chatId, ...messageData } = msg

        try {
          await chatStorage.addMessage(newChat.id, {
            ...messageData,
            created: msg.created // Preserve original creation time
          })
        } catch (error) {
          console.error(`Failed to copy message ${msg.id} during fork:`, error)
          // Continue with other messages
        }
      }
    }

    return newChat
  }

  async function forkChatFromMessage(
    sourceChatId: number,
    messageId: number,
    excludedMessageIds: number[] = []
  ): Promise<Chat> {
    const sourceChat = await chatStorage.getChat(sourceChatId)
    if (!sourceChat) {
      throwNotFound('Source chat', sourceChatId)
    }

    const sourceMessages = await chatStorage.getChatMessages(sourceChatId)
    const startMessage = sourceMessages.find((m) => m.id === messageId)
    if (!startMessage) {
      throw new ApiError(
        404,
        `Starting message with ID ${messageId} not found in chat ${sourceChatId}.`,
        'MESSAGE_NOT_FOUND'
      )
    }

    const newTitle = `Fork from ${sourceChat.title} at message (${messageId})`

    // Create the new chat
    const newChat = await chatStorage.createChat({ title: newTitle })

    // Get messages up to and including the startMessage
    const sortedMessages = sourceMessages.sort((a, b) => a.created - b.created)
    const indexOfStart = sortedMessages.findIndex((m) => m.id === messageId)

    if (indexOfStart === -1) {
      // Should not happen if startMessage was found above
      throw new ApiError(
        500,
        `Internal error: Could not re-find the starting message ${messageId} in chat sequence.`,
        'MESSAGE_SEQUENCE_ERROR'
      )
    }

    const messagesToCopy = sortedMessages.slice(0, indexOfStart + 1)

    for (const msg of messagesToCopy) {
      if (!excludedMessageIds.includes(msg.id)) {
        // Copy the message to the new chat
        const { id, created, updated, chatId, ...messageData } = msg

        try {
          await chatStorage.addMessage(newChat.id, {
            ...messageData,
            created: msg.created // Preserve original creation time
          })
        } catch (error) {
          console.error(`Failed to copy message ${msg.id} during fork from message:`, error)
          // Continue with other messages
        }
      }
    }

    return newChat
  }

  async function getChatById(chatId: number): Promise<Chat | null> {
    return await chatStorage.getChat(chatId)
  }

  return {
    createChat,
    updateChatTimestamp,
    saveMessage,
    updateMessageContent, // Signature changed
    getAllChats,
    getChatMessages,
    updateChat,
    deleteChat,
    deleteMessage, // Signature changed
    forkChat,
    forkChatFromMessage,
    getChatById
  }
}

export const chatService = createChatService()
