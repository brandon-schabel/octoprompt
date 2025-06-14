// Recent changes:
// 1. Initial implementation of attachment storage for chat file uploads
// 2. File system based storage with organized directory structure
// 3. Support for saving, retrieving, and deleting file attachments
// 4. Metadata tracking for uploaded files with creation timestamps
// 5. Stream-based file operations for efficient memory usage

import { join } from 'path'
import { mkdir, unlink, readdir } from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { existsSync } from 'fs'
import { Readable } from 'stream'

interface AttachmentMetadata {
  id: number
  fileName: string
  mimeType: string
  size: number
  created: number
}

interface FileWithStream {
  type: string
  size: number
  stream: () => ReadableStream
}

class AttachmentStorage {
  private baseDir: string

  constructor(baseDir: string = join(process.cwd(), 'data', 'attachments')) {
    this.baseDir = baseDir
  }

  private async ensureDir(path: string): Promise<void> {
    if (!existsSync(path)) {
      await mkdir(path, { recursive: true })
    }
  }

  private getAttachmentDir(chatId: number): string {
    return join(this.baseDir, 'chats', chatId.toString())
  }

  private getAttachmentPath(chatId: number, attachmentId: number, fileName: string): string {
    return join(this.getAttachmentDir(chatId), `${attachmentId}_${fileName}`)
  }

  async saveFile(chatId: number, file: File): Promise<AttachmentMetadata> {
    const attachmentId = Date.now()
    const attachmentDir = this.getAttachmentDir(chatId)
    await this.ensureDir(attachmentDir)

    const filePath = this.getAttachmentPath(chatId, attachmentId, file.name)
    
    // Convert File to Node.js stream and write to disk
    const buffer = await file.arrayBuffer()
    const nodeStream = Readable.from(Buffer.from(buffer))
    const writeStream = createWriteStream(filePath)
    
    await pipeline(nodeStream, writeStream)

    const metadata: AttachmentMetadata = {
      id: attachmentId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      created: attachmentId
    }

    return metadata
  }

  async getFile(
    chatId: number, 
    messageId: number, 
    attachmentId: number, 
    fileName: string
  ): Promise<FileWithStream | null> {
    const filePath = this.getAttachmentPath(chatId, attachmentId, fileName)
    
    if (!existsSync(filePath)) {
      return null
    }

    // Get file stats for size
    const { size } = await import('fs/promises').then(fs => fs.stat(filePath))
    
    // Determine MIME type from file extension
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'json': 'application/json',
      'js': 'text/javascript',
      'ts': 'text/typescript',
      'html': 'text/html',
      'css': 'text/css',
      'md': 'text/markdown'
    }
    
    const type = mimeTypes[ext] || 'application/octet-stream'

    return {
      type,
      size,
      stream: () => {
        const nodeStream = createReadStream(filePath)
        // Convert Node.js stream to Web stream
        return Readable.toWeb(nodeStream) as ReadableStream
      }
    }
  }

  async deleteFileById(
    chatId: number, 
    messageId: number, 
    attachmentId: number
  ): Promise<boolean> {
    const attachmentDir = this.getAttachmentDir(chatId)
    
    if (!existsSync(attachmentDir)) {
      return false
    }

    // Find files matching the attachmentId pattern
    const files = await readdir(attachmentDir)
    const matchingFiles = files.filter(file => file.startsWith(`${attachmentId}_`))
    
    if (matchingFiles.length === 0) {
      return false
    }

    // Delete all matching files
    for (const file of matchingFiles) {
      const filePath = join(attachmentDir, file)
      await unlink(filePath)
    }

    return true
  }

  async deleteAllChatAttachments(chatId: number): Promise<void> {
    const attachmentDir = this.getAttachmentDir(chatId)
    
    if (existsSync(attachmentDir)) {
      const files = await readdir(attachmentDir)
      for (const file of files) {
        await unlink(join(attachmentDir, file))
      }
      // Optionally remove the empty directory
      await import('fs/promises').then(fs => fs.rmdir(attachmentDir))
    }
  }
}

// Export a singleton instance
export const attachmentStorage = new AttachmentStorage()