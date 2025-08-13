import { chatStorage } from '@promptliano/storage'
import { claudeCodeMCPService } from './claude-code-mcp-service'
import { ChatSchema } from '@promptliano/schemas'
import type { ClaudeMessage } from '@promptliano/schemas'
import type { Chat, ChatMessage } from '@promptliano/schemas'
import { normalizeToUnixMs } from '@promptliano/shared'

export class ClaudeCodeImportService {
  /**
   * Import a Claude Code session into a Promptliano chat
   * @param projectId - The project ID
   * @param sessionId - The Claude Code session ID to import
   * @returns The created chat
   */
  async importSession(projectId: number, sessionId: string): Promise<Chat> {
    // Get all messages from the Claude Code session
    const messages = await claudeCodeMCPService.getSessionMessages(projectId, sessionId)

    if (!messages || messages.length === 0) {
      throw new Error('No messages found in session')
    }

    // Generate a title from the first user message
    const firstUserMessage = messages.find((m) => m.message.role === 'user')
    const title = this.generateChatTitle(firstUserMessage, sessionId)

    // Create a new chat with project association
    const chatId = chatStorage.generateId()
    const now = normalizeToUnixMs(new Date())

    const newChat: Chat = {
      id: chatId,
      title,
      projectId,
      created: now,
      updated: now
    }

    // Validate and store the chat
    const validatedChat = ChatSchema.parse(newChat)
    const allChats = await chatStorage.readChats()
    allChats[String(chatId)] = validatedChat
    await chatStorage.writeChats(allChats)

    const chat = validatedChat

    // Convert and import messages
    const importPromises = messages.map((message, index) => this.importMessage(chat.id, message, index))

    await Promise.all(importPromises)

    return chat
  }

  /**
   * Generate a descriptive title for the chat
   */
  private generateChatTitle(firstUserMessage: ClaudeMessage | undefined, sessionId: string): string {
    if (firstUserMessage) {
      const content = this.extractTextContent(firstUserMessage.message.content)
      // Take first 50 characters of the first user message
      const preview = content.substring(0, 50).trim()
      return preview.length === 50 ? `${preview}...` : preview
    }

    // Fallback to session ID if no user message
    return `Claude Code Session ${sessionId}`
  }

  /**
   * Import a single Claude Code message as a chat message
   */
  private async importMessage(chatId: number, claudeMessage: ClaudeMessage, order: number): Promise<ChatMessage> {
    const content = this.extractTextContent(claudeMessage.message.content)
    const timestamp = new Date(claudeMessage.timestamp).getTime()

    // Map Claude Code roles to Promptliano roles
    let role: 'user' | 'assistant' | 'system'
    if (claudeMessage.message.role === 'user') {
      role = 'user'
    } else if (claudeMessage.message.role === 'assistant') {
      role = 'assistant'
    } else {
      role = 'system'
    }

    // Generate a unique message ID
    const messageId = Date.now() + order

    const message: ChatMessage = {
      id: messageId,
      chatId,
      role,
      content,
      created: timestamp,
      updated: timestamp
    }

    return chatStorage.addMessage(message)
  }

  /**
   * Extract text content from Claude's complex content format
   */
  private extractTextContent(content: string | any[]): string {
    if (typeof content === 'string') {
      return content
    }

    // Handle array of content items
    return content
      .map((item) => {
        if (item.type === 'text') {
          return item.text
        } else if (item.type === 'tool_use') {
          return `[Tool: ${item.name}]`
        } else if (item.type === 'tool_result') {
          // Extract text from tool result if available
          if (typeof item.content === 'string') {
            return item.content
          } else if (Array.isArray(item.content)) {
            return item.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n')
          }
          return '[Tool Result]'
        } else if (item.type === 'image') {
          return '[Image]'
        }
        return ''
      })
      .filter((text) => text.length > 0)
      .join('\n\n')
  }
}

export const claudeCodeImportService = new ClaudeCodeImportService()
