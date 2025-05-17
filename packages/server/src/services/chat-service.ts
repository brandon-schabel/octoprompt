import { ChatSchema, ChatMessageSchema, ChatMessage, Chat, ExtendedChatMessage } from 'shared/src/schemas/chat.schemas'
import { ApiError } from 'shared'
import { chatStorage, type ChatsStorage, type ChatMessagesStorage } from '@/utils/storage/chat-storage' // New import
import { ZodError } from 'zod'

export type CreateChatOptions = {
  copyExisting?: boolean
  currentChatId?: string
}
/**
 * Returns an object of functions handling chat logic in a functional style
 * using JSON file storage.
 */
export function createChatService() {
  async function createChat(title: string, options?: CreateChatOptions): Promise<Chat> {
    const chatId = chatStorage.generateId('chat')
    const now = new Date().toISOString()

    const newChatData: Chat = {
      id: chatId,
      title,
      createdAt: now,
      updatedAt: now
    }

    try {
      ChatSchema.parse(newChatData) // Validate before adding to storage
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(`Validation failed for new chat data: ${error.message}`, error.flatten().fieldErrors)
        throw new ApiError(500, `Internal validation error creating chat.`, 'CHAT_VALIDATION_ERROR', error.flatten().fieldErrors)
      }
      throw error // Should not happen if data is constructed correctly
    }

    const allChats = await chatStorage.readChats()

    if (options?.copyExisting && options?.currentChatId) {
      if (!allChats[options.currentChatId]) {
        throw new ApiError(
          404,
          `Referenced chat with ID ${options.currentChatId} not found for copying.`,
          'REFERENCED_CHAT_NOT_FOUND'
        )
      }
    }
    if (allChats[chatId]) {
      // Extremely unlikely with UUIDs but good to check
      throw new ApiError(509, `Chat ID conflict for ${chatId}`, 'CHAT_ID_CONFLICT');
    }

    allChats[chatId] = newChatData
    await chatStorage.writeChats(allChats)
    // Initialize an empty messages file for the new chat
    await chatStorage.writeChatMessages(chatId, {})

    if (options?.copyExisting && options?.currentChatId) {
      const sourceMessages = await chatStorage.readChatMessages(options.currentChatId)
      const messagesToCopy: ChatMessagesStorage = {}
      for (const msg of Object.values(sourceMessages)) {
        const newMessageId = chatStorage.generateId('msg')
        // Preserve original creation timestamp for ordering, assign new ID and new chatId
        const copiedMsg: ChatMessage = {
          ...msg,
          id: newMessageId,
          chatId: chatId,
          // createdAt is already part of msg and should be a valid ISO string
        }
        try {
          ChatMessageSchema.parse(copiedMsg);
          messagesToCopy[newMessageId] = copiedMsg;
        } catch (error) {
          if (error instanceof ZodError) {
            console.error(`Validation failed for copied message ${msg.id} to new chat ${chatId}: ${error.message}`, error.flatten().fieldErrors);
            // Decide whether to skip this message or throw an error for the whole operation
          }
        }
      }
      if (Object.keys(messagesToCopy).length > 0) {
        await chatStorage.writeChatMessages(chatId, messagesToCopy)
      }
    }
    return newChatData
  }

  async function updateChatTimestamp(chatId: string): Promise<void> {
    const allChats = await chatStorage.readChats()
    if (!allChats[chatId]) {
      throw new ApiError(404, `Chat with ID ${chatId} not found for timestamp update.`, 'CHAT_NOT_FOUND')
    }
    allChats[chatId].updatedAt = new Date().toISOString()
    try {
      ChatSchema.parse(allChats[chatId]); // Re-validate before writing
      await chatStorage.writeChats(allChats)
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ApiError(500, `Validation failed updating chat timestamp for ${chatId}.`, 'CHAT_VALIDATION_ERROR', error.flatten().fieldErrors);
      }
      throw error;
    }
  }

  async function saveMessage(message: ExtendedChatMessage): Promise<ExtendedChatMessage> {
    const allChats = await chatStorage.readChats()
    if (!allChats[message.chatId]) {
      throw new ApiError(
        404,
        `Chat with ID ${message.chatId} not found. Cannot save message.`,
        'CHAT_NOT_FOUND_FOR_MESSAGE'
      )
    }

    const messageId = message.id || chatStorage.generateId('msg')
    const now = new Date().toISOString()

    const finalMessageData: ChatMessage = {
      id: messageId,
      chatId: message.chatId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt || now, // Use provided createdAt if exists (e.g. for imported messages), else new
    }

    try {
      ChatMessageSchema.parse(finalMessageData);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(`Validation failed for new message data: ${error.message}`, error.flatten().fieldErrors);
        throw new ApiError(500, `Internal validation error saving message.`, 'MESSAGE_VALIDATION_ERROR', error.flatten().fieldErrors);
      }
      throw error;
    }

    const chatMessages = await chatStorage.readChatMessages(message.chatId)
    if (chatMessages[messageId]) {
      // Handle update or throw conflict, for now, let's assume saveMessage can overwrite if ID is provided and exists.
      // Or, more strictly, throw an error if message.id was provided and already exists.
      console.warn(`Message with ID ${messageId} already exists in chat ${message.chatId}. Overwriting.`);
    }
    chatMessages[messageId] = finalMessageData
    await chatStorage.writeChatMessages(message.chatId, chatMessages)
    await updateChatTimestamp(message.chatId)

    return { ...finalMessageData, tempId: message.tempId }
  }

  async function updateMessageContent(chatId: string, messageId: string, content: string): Promise<void> {
    const allChats = await chatStorage.readChats()
    if (!allChats[chatId]) {
      // This check could be redundant if readChatMessages implies chat existence
      throw new ApiError(404, `Chat with ID ${chatId} not found.`, 'CHAT_NOT_FOUND')
    }

    const chatMessages = await chatStorage.readChatMessages(chatId)
    if (!chatMessages[messageId]) {
      throw new ApiError(404, `Message with ID ${messageId} not found in chat ${chatId} for update.`, 'MESSAGE_NOT_FOUND')
    }

    chatMessages[messageId].content = content
    // chatMessages[messageId].updatedAt = new Date().toISOString(); // If messages had an updatedAt field

    try {
      ChatMessageSchema.parse(chatMessages[messageId]); // Re-validate before writing
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(`Validation failed updating message content for ${messageId}: ${error.message}`, error.flatten().fieldErrors);
        throw new ApiError(500, `Internal validation error updating message.`, 'MESSAGE_VALIDATION_ERROR', error.flatten().fieldErrors);
      }
      throw error;
    }

    await chatStorage.writeChatMessages(chatId, chatMessages)
    await updateChatTimestamp(chatId)
  }

  async function getAllChats(): Promise<Chat[]> {
    const allChatsData = await chatStorage.readChats()
    const chatList = Object.values(allChatsData)
    chatList.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) // Sort by most recently updated
    return chatList
  }

  async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
    const allChats = await chatStorage.readChats()
    if (!allChats[chatId]) {
      throw new ApiError(404, `Chat with ID ${chatId} not found.`, 'CHAT_NOT_FOUND')
    }

    const chatMessagesData = await chatStorage.readChatMessages(chatId)
    const messageList = Object.values(chatMessagesData)
    messageList.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) // Sort by creation time
    return messageList
  }

  async function updateChat(chatId: string, title: string): Promise<Chat> {
    const allChats = await chatStorage.readChats()
    if (!allChats[chatId]) {
      throw new ApiError(404, `Chat with ID ${chatId} not found for update.`, 'CHAT_NOT_FOUND')
    }

    allChats[chatId].title = title
    allChats[chatId].updatedAt = new Date().toISOString()

    try {
      ChatSchema.parse(allChats[chatId]);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(`Validation failed updating chat ${chatId}: ${error.message}`, error.flatten().fieldErrors);
        throw new ApiError(500, `Internal validation error updating chat.`, 'CHAT_VALIDATION_ERROR', error.flatten().fieldErrors);
      }
      throw error;
    }
    await chatStorage.writeChats(allChats)
    return allChats[chatId]
  }

  async function deleteChat(chatId: string): Promise<void> {
    const allChats = await chatStorage.readChats()
    if (!allChats[chatId]) {
      throw new ApiError(404, `Chat with ID ${chatId} not found for deletion.`, 'CHAT_NOT_FOUND')
    }

    delete allChats[chatId]
    await chatStorage.writeChats(allChats)
    await chatStorage.deleteChatData(chatId) // Delete the chat's message directory
  }

  // MODIFIED: Added chatId parameter
  async function deleteMessage(chatId: string, messageId: string): Promise<void> {
    const allChats = await chatStorage.readChats()
    if (!allChats[chatId]) {
      throw new ApiError(404, `Chat with ID ${chatId} not found when attempting to delete message ${messageId}.`, 'CHAT_NOT_FOUND')
    }
    const chatMessages = await chatStorage.readChatMessages(chatId)
    if (!chatMessages[messageId]) {
      throw new ApiError(404, `Message with ID ${messageId} not found in chat ${chatId} for deletion.`, 'MESSAGE_NOT_FOUND')
    }

    delete chatMessages[messageId]
    await chatStorage.writeChatMessages(chatId, chatMessages)
    await updateChatTimestamp(chatId)
  }

  async function forkChat(sourceChatId: string, excludedMessageIds: string[] = []): Promise<Chat> {
    const allChats = await chatStorage.readChats()
    const sourceChat = allChats[sourceChatId]
    if (!sourceChat) {
      throw new ApiError(404, `Source chat with ID ${sourceChatId} not found for forking.`, 'SOURCE_CHAT_NOT_FOUND')
    }

    const newTitle = `Fork of ${sourceChat.title} (${new Date().toLocaleTimeString()})`
    const newChatId = chatStorage.generateId('chat')
    const now = new Date().toISOString()
    const newChatData: Chat = {
      id: newChatId,
      title: newTitle,
      createdAt: now,
      updatedAt: now
    }
    ChatSchema.parse(newChatData); // Validate

    allChats[newChatId] = newChatData
    await chatStorage.writeChats(allChats)

    const sourceMessagesAll = await chatStorage.readChatMessages(sourceChatId)
    const messagesToCopyRecord: ChatMessagesStorage = {}

    for (const msg of Object.values(sourceMessagesAll)) {
      if (!excludedMessageIds.includes(msg.id)) {
        const newMessageId = chatStorage.generateId('msg') // New ID for the message in the new chat
        const copiedMsgData: ChatMessage = {
          ...msg,
          id: newMessageId,
          chatId: newChatId, // Point to the new chat
          // createdAt is preserved from original message
        }
        ChatMessageSchema.parse(copiedMsgData); // Validate
        messagesToCopyRecord[newMessageId] = copiedMsgData
      }
    }

    await chatStorage.writeChatMessages(newChatId, messagesToCopyRecord)
    return newChatData
  }

  async function forkChatFromMessage(
    sourceChatId: string,
    messageId: string, // The message ID to fork *up to and including*
    excludedMessageIds: string[] = []
  ): Promise<Chat> {
    const allChats = await chatStorage.readChats()
    const sourceChat = allChats[sourceChatId]
    if (!sourceChat) {
      throw new ApiError(404, `Source chat with ID ${sourceChatId} not found.`, 'SOURCE_CHAT_NOT_FOUND')
    }

    const sourceMessagesAll = await chatStorage.readChatMessages(sourceChatId)
    const startMessage = sourceMessagesAll[messageId]
    if (!startMessage) {
      throw new ApiError(404, `Starting message with ID ${messageId} not found in chat ${sourceChatId}.`, 'MESSAGE_NOT_FOUND')
    }
    // No need for: if (startMessage.chat_id !== sourceChatId) as we fetched from the correct file.

    const newTitle = `Fork from ${sourceChat.title} at message (${messageId.substring(0, 8)})`
    const newChatId = chatStorage.generateId('chat')
    const now = new Date().toISOString()
    const newChatData: Chat = { id: newChatId, title: newTitle, createdAt: now, updatedAt: now }
    ChatSchema.parse(newChatData); // Validate

    allChats[newChatId] = newChatData
    await chatStorage.writeChats(allChats)

    // Get messages up to and including the startMessage
    const sourceMessagesArray = Object.values(sourceMessagesAll).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const indexOfStart = sourceMessagesArray.findIndex((m) => m.id === messageId)

    if (indexOfStart === -1) {
      // Should not happen if startMessage was found above
      throw new ApiError(500, `Internal error: Could not re-find the starting message ${messageId} in chat sequence.`, 'MESSAGE_SEQUENCE_ERROR')
    }

    const messagesToConsider = sourceMessagesArray.slice(0, indexOfStart + 1)
    const messagesToCopyRecord: ChatMessagesStorage = {}

    for (const msg of messagesToConsider) {
      if (!excludedMessageIds.includes(msg.id)) {
        const newMessageId = chatStorage.generateId('msg')
        const copiedMsgData: ChatMessage = { ...msg, id: newMessageId, chatId: newChatId }
        ChatMessageSchema.parse(copiedMsgData); // Validate
        messagesToCopyRecord[newMessageId] = copiedMsgData
      }
    }

    await chatStorage.writeChatMessages(newChatId, messagesToCopyRecord)
    return newChatData
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
    forkChatFromMessage
  }
}

export const chatService = createChatService()