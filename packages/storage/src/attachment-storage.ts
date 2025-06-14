// Recent changes:
// 1. Initial implementation of attachment storage for chat messages
// 2. File upload/download/delete operations with Bun File API
// 3. Safe filename sanitization and directory management
// 4. Error handling for storage operations
// 5. ID generation and path construction for attachments

import path from 'node:path'
import fs from 'node:fs/promises'
import { ApiError } from '@octoprompt/shared'
import { normalizeToUnixMs } from '@octoprompt/shared/src/utils/parse-timestamp'

// Define a base directory for chat attachments
const CHAT_ATTACHMENTS_BASE_DIR = path.resolve(process.cwd(), 'data', 'chat_attachments')

// Helper to ensure a directory exists
async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error: any) {
    if (error.code !== 'EEXIST') { // Ignore if directory already exists
      console.error(`Error creating directory ${dirPath}:`, error)
      throw new ApiError(500, `Failed to ensure directory exists: ${dirPath}`)
    }
  }
}

// Generates a unique ID for attachments (can be a timestamp or UUID)
function generateAttachmentId(): number {
  return normalizeToUnixMs(Date.now())
}

// Constructs the path for an attachment
function getAttachmentStoragePath(
  chatId: number,
  messageId: number, // This could be a temporary ID during upload
  attachmentId: number,
  fileName: string
): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_') // Sanitize filename
  return path.join(CHAT_ATTACHMENTS_BASE_DIR, chatId.toString(), messageId.toString(), `${attachmentId}_${safeFileName}`)
}

export const attachmentStorage = {
  async saveFile(
    chatId: number,
    file: File // Bun's File object from Hono form data
  ): Promise<{ id: number; fileName: string; mimeType: string; size: number; storagePath: string; created: number }> {
    const attachmentId = generateAttachmentId()
    // Use a temporary messageId of 0 for now - this can be updated when the message is created
    const tempMessageId = 0
    const storagePath = getAttachmentStoragePath(chatId, tempMessageId, attachmentId, file.name)
    const dir = path.dirname(storagePath)
    await ensureDirExists(dir)

    try {
      await Bun.write(storagePath, file) // Use Bun.write for efficient file saving
      return {
        id: attachmentId,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        storagePath, // Store the full path or a relative one depending on serving strategy
        created: normalizeToUnixMs(Date.now()),
      }
    } catch (error: any) {
      console.error(`Failed to save attachment to ${storagePath}:`, error)
      throw new ApiError(500, `Storage error: Could not save file ${file.name}.`)
    }
  },

  async saveFileWithMessage(
    chatId: number,
    messageId: number,
    file: File // Bun's File object from Hono form data
  ): Promise<{ id: number; fileName: string; mimeType: string; size: number; storagePath: string; created: number }> {
    const attachmentId = generateAttachmentId()
    const storagePath = getAttachmentStoragePath(chatId, messageId, attachmentId, file.name)
    const dir = path.dirname(storagePath)
    await ensureDirExists(dir)

    try {
      await Bun.write(storagePath, file) // Use Bun.write for efficient file saving
      return {
        id: attachmentId,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        storagePath, // Store the full path or a relative one depending on serving strategy
        created: normalizeToUnixMs(Date.now()),
      }
    } catch (error: any) {
      console.error(`Failed to save attachment to ${storagePath}:`, error)
      throw new ApiError(500, `Storage error: Could not save file ${file.name}.`)
    }
  },

  async getFile(
    chatId: number,
    messageId: number,
    attachmentId: number,
    fileName: string
  ): Promise<ReturnType<typeof Bun.file> | null> {
    const storagePath = getAttachmentStoragePath(chatId, messageId, attachmentId, fileName)
    try {
      const bunFile = Bun.file(storagePath)
      if (await bunFile.exists()) {
        return bunFile
      }
      return null
    } catch (error) {
      console.error(`Error accessing attachment ${storagePath}:`, error)
      return null
    }
  },

  async deleteFile(
    chatId: number,
    messageId: number,
    attachmentId: number,
    fileName: string
  ): Promise<boolean> {
    const storagePath = getAttachmentStoragePath(chatId, messageId, attachmentId, fileName)
    try {
      if (await Bun.file(storagePath).exists()) {
        await fs.unlink(storagePath)
        // Optionally, try to remove empty directories if this was the last file
        const dir = path.dirname(storagePath)
        const filesInDir = await fs.readdir(dir)
        if (filesInDir.length === 0) {
          await fs.rmdir(dir)
          const messageDir = path.dirname(dir)
          const filesInMsgDir = await fs.readdir(messageDir)
          if (filesInMsgDir.length === 0) {
            await fs.rmdir(messageDir)
          }
        }
      }
      return true
    } catch (error: any) {
      console.error(`Error deleting attachment ${storagePath}:`, error)
      // Don't throw if file not found, just return false or handle as per need
      return false
    }
  },

  async deleteFileById(
    chatId: number,
    messageId: number,
    attachmentId: number
  ): Promise<boolean> {
    // Find files that match the attachment ID pattern in the message directory
    const messageDir = path.join(CHAT_ATTACHMENTS_BASE_DIR, chatId.toString(), messageId.toString())
    try {
      const files = await fs.readdir(messageDir)
      const matchingFile = files.find(file => file.startsWith(`${attachmentId}_`))
      
      if (matchingFile) {
        const fullPath = path.join(messageDir, matchingFile)
        await fs.unlink(fullPath)
        
        // Clean up empty directories
        const remainingFiles = await fs.readdir(messageDir)
        if (remainingFiles.length === 0) {
          await fs.rmdir(messageDir)
          const chatDir = path.dirname(messageDir)
          const remainingChatFiles = await fs.readdir(chatDir)
          if (remainingChatFiles.length === 0) {
            await fs.rmdir(chatDir)
          }
        }
        return true
      }
      return false
    } catch (error: any) {
      console.error(`Error deleting attachment by ID ${attachmentId}:`, error)
      return false
    }
  }
}
