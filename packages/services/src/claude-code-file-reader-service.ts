import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { createReadStream, existsSync } from 'fs'
import { createInterface } from 'readline'
import { watch } from 'chokidar'
import { z } from 'zod'
import { 
  ClaudeMessageSchema, 
  ClaudeSessionSchema,
  ClaudeProjectDataSchema,
  type ClaudeMessage,
  type ClaudeSession,
  type ClaudeProjectData
} from '@promptliano/schemas'
import { createLogger } from './utils/logger'
import { ApiError } from '@promptliano/shared'

const logger = createLogger('ClaudeCodeFileReaderService')

export class ClaudeCodeFileReaderService {
  private readonly platform = process.platform

  /**
   * Get Claude Code config directory based on platform
   */
  getClaudeConfigDir(): string {
    const home = os.homedir()
    
    switch (this.platform) {
      case 'darwin':
        return path.join(home, '.claude')
      case 'linux':
        // Check new location first, fall back to legacy
        const newPath = path.join(home, '.config', 'claude')
        const legacyPath = path.join(home, '.claude')
        return existsSync(newPath) ? newPath : legacyPath
      case 'win32':
        return path.join(process.env.APPDATA || home, 'Claude')
      default:
        return path.join(home, '.claude')
    }
  }

  /**
   * Encode project path for Claude's directory structure
   */
  encodeProjectPath(projectPath: string): string {
    // Replace all path separators with hyphens
    return projectPath.replace(/[/\\]/g, '-')
  }

  /**
   * Decode Claude's encoded path back to original
   */
  decodeProjectPath(encodedPath: string): string {
    // This is lossy - we can't perfectly reconstruct the original path
    // But we can make a reasonable guess based on platform
    if (this.platform === 'win32' && encodedPath.startsWith('C--')) {
      return encodedPath.replace(/^C--/, 'C:\\').replace(/-/g, '\\')
    }
    return encodedPath.replace(/-/g, '/')
  }

  /**
   * Check if Claude Code is installed and accessible
   */
  async isClaudeCodeInstalled(): Promise<boolean> {
    try {
      const configDir = this.getClaudeConfigDir()
      await fs.access(configDir)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get all project directories in Claude config
   */
  async getClaudeProjects(): Promise<string[]> {
    const configDir = this.getClaudeConfigDir()
    const projectsDir = path.join(configDir, 'projects')
    
    try {
      const entries = await fs.readdir(projectsDir, { withFileTypes: true })
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
    } catch (error) {
      logger.debug('Failed to read Claude projects directory:', error)
      return []
    }
  }

  /**
   * Parse a single JSONL line into a Claude message
   */
  private parseJsonLine(line: string): ClaudeMessage | null {
    if (!line.trim()) return null
    
    try {
      const data = JSON.parse(line)
      const validated = ClaudeMessageSchema.safeParse(data)
      
      if (validated.success) {
        return validated.data
      } else {
        logger.debug('Invalid Claude message format:', validated.error)
        return null
      }
    } catch (error) {
      logger.debug('Failed to parse JSONL line:', error)
      return null
    }
  }

  /**
   * Read all chat messages for a project
   */
  async readChatHistory(projectPath: string): Promise<ClaudeMessage[]> {
    const configDir = this.getClaudeConfigDir()
    const encodedPath = this.encodeProjectPath(projectPath)
    const projectDir = path.join(configDir, 'projects', encodedPath)
    
    if (!existsSync(projectDir)) {
      logger.debug(`No Claude data found for project: ${projectPath}`)
      return []
    }
    
    const messages: ClaudeMessage[] = []
    
    try {
      const files = await fs.readdir(projectDir)
      const jsonlFiles = files.filter(file => file.endsWith('.jsonl'))
      
      for (const file of jsonlFiles) {
        const filePath = path.join(projectDir, file)
        const fileMessages = await this.readJsonlFile(filePath)
        messages.push(...fileMessages)
      }
      
      // Sort by timestamp
      return messages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
    } catch (error) {
      logger.error('Failed to read chat history:', error)
      throw new ApiError(500, 'Failed to read Claude chat history')
    }
  }

  /**
   * Read a single JSONL file
   */
  private async readJsonlFile(filePath: string): Promise<ClaudeMessage[]> {
    const messages: ClaudeMessage[] = []
    
    return new Promise((resolve, reject) => {
      const fileStream = createReadStream(filePath)
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      })
      
      rl.on('line', (line) => {
        const message = this.parseJsonLine(line)
        if (message) {
          messages.push(message)
        }
      })
      
      rl.on('close', () => resolve(messages))
      rl.on('error', reject)
    })
  }

  /**
   * Get all sessions for a project
   */
  async getSessions(projectPath: string): Promise<ClaudeSession[]> {
    const messages = await this.readChatHistory(projectPath)
    
    // Group messages by session
    const sessionMap = new Map<string, ClaudeMessage[]>()
    
    for (const message of messages) {
      if (!sessionMap.has(message.sessionId)) {
        sessionMap.set(message.sessionId, [])
      }
      sessionMap.get(message.sessionId)!.push(message)
    }
    
    // Create session metadata
    const sessions: ClaudeSession[] = []
    
    for (const [sessionId, sessionMessages] of sessionMap) {
      if (sessionMessages.length === 0) continue
      
      const firstMessage = sessionMessages[0]
      const lastMessage = sessionMessages[sessionMessages.length - 1]
      
      if (!firstMessage || !lastMessage) {
        continue
      }
      
      // Find the most recent git branch and cwd
      let gitBranch: string | undefined
      let cwd: string | undefined
      
      for (let i = sessionMessages.length - 1; i >= 0; i--) {
        const msg = sessionMessages[i]
        if (!msg) continue
        if (!gitBranch && msg.gitBranch) gitBranch = msg.gitBranch
        if (!cwd && msg.cwd) cwd = msg.cwd
        if (gitBranch && cwd) break
      }
      
      // Calculate token breakdown
      let totalInputTokens = 0
      let totalCacheCreationTokens = 0
      let totalCacheReadTokens = 0
      let totalOutputTokens = 0
      let totalTokensUsed = 0
      let totalCostUsd = 0
      const serviceTiers = new Set<string>()
      
      for (const msg of sessionMessages) {
        // New token usage format
        if (msg.message.usage) {
          if (msg.message.usage.input_tokens) {
            totalInputTokens += msg.message.usage.input_tokens
          }
          if (msg.message.usage.cache_creation_input_tokens) {
            totalCacheCreationTokens += msg.message.usage.cache_creation_input_tokens
          }
          if (msg.message.usage.cache_read_input_tokens) {
            totalCacheReadTokens += msg.message.usage.cache_read_input_tokens
          }
          if (msg.message.usage.output_tokens) {
            totalOutputTokens += msg.message.usage.output_tokens
          }
          if (msg.message.usage.service_tier) {
            serviceTiers.add(msg.message.usage.service_tier)
          }
        }
        // Legacy fields
        if (msg.tokensUsed) totalTokensUsed += msg.tokensUsed
        if (msg.costUsd) totalCostUsd += msg.costUsd
      }
      
      const totalTokens = totalInputTokens + totalCacheCreationTokens + totalCacheReadTokens + totalOutputTokens
      
      sessions.push({
        sessionId,
        projectPath,
        startTime: firstMessage.timestamp,
        lastUpdate: lastMessage.timestamp,
        messageCount: sessionMessages.length,
        gitBranch,
        cwd,
        tokenUsage: totalTokens > 0 ? {
          totalInputTokens,
          totalCacheCreationTokens,
          totalCacheReadTokens,
          totalOutputTokens,
          totalTokens
        } : undefined,
        serviceTiers: serviceTiers.size > 0 ? Array.from(serviceTiers) : undefined,
        totalTokensUsed: totalTokensUsed > 0 ? totalTokensUsed : undefined,
        totalCostUsd: totalCostUsd > 0 ? totalCostUsd : undefined
      })
    }
    
    // Sort by last update time (most recent first)
    return sessions.sort((a, b) => 
      new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime()
    )
  }

  /**
   * Get messages for a specific session
   */
  async getSessionMessages(projectPath: string, sessionId: string): Promise<ClaudeMessage[]> {
    const allMessages = await this.readChatHistory(projectPath)
    return allMessages.filter(msg => msg.sessionId === sessionId)
  }

  /**
   * Get project metadata from Claude files
   */
  async getProjectData(projectPath: string): Promise<ClaudeProjectData> {
    const messages = await this.readChatHistory(projectPath)
    const sessions = await this.getSessions(projectPath)
    
    // Extract unique branches and working directories
    const branches = new Set<string>()
    const workingDirectories = new Set<string>()
    
    for (const msg of messages) {
      if (msg.gitBranch) branches.add(msg.gitBranch)
      if (msg.cwd) workingDirectories.add(msg.cwd)
    }
    
    // Find first and last message times
    let firstMessageTime: string | undefined
    let lastMessageTime: string | undefined
    
    if (messages.length > 0) {
      const sorted = [...messages].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      if (first) firstMessageTime = first.timestamp
      if (last) lastMessageTime = last.timestamp
    }
    
    return {
      projectPath,
      encodedPath: this.encodeProjectPath(projectPath),
      sessions,
      totalMessages: messages.length,
      firstMessageTime,
      lastMessageTime,
      branches: Array.from(branches).sort(),
      workingDirectories: Array.from(workingDirectories).sort()
    }
  }

  /**
   * Watch for real-time updates to Claude chat files
   */
  watchChatHistory(
    projectPath: string, 
    onUpdate: (messages: ClaudeMessage[]) => void
  ): () => void {
    const configDir = this.getClaudeConfigDir()
    const encodedPath = this.encodeProjectPath(projectPath)
    const watchPath = path.join(configDir, 'projects', encodedPath, '*.jsonl')
    
    const watcher = watch(watchPath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    })
    
    const handleUpdate = async () => {
      try {
        const messages = await this.readChatHistory(projectPath)
        onUpdate(messages)
      } catch (error) {
        logger.error('Error in file watcher:', error)
      }
    }
    
    watcher
      .on('add', handleUpdate)
      .on('change', handleUpdate)
    
    // Return cleanup function
    return () => {
      watcher.close()
    }
  }

  /**
   * Find Claude project by fuzzy matching path
   */
  async findProjectByPath(targetPath: string): Promise<string | null> {
    const encodedTarget = this.encodeProjectPath(targetPath)
    const projects = await this.getClaudeProjects()
    
    // First try exact match
    if (projects.includes(encodedTarget)) {
      return targetPath
    }
    
    // Try to find a project that ends with the target path
    for (const encodedProject of projects) {
      const decodedPath = this.decodeProjectPath(encodedProject)
      if (decodedPath.endsWith(targetPath) || targetPath.endsWith(decodedPath)) {
        return decodedPath
      }
    }
    
    return null
  }
}

// Create singleton instance
export const claudeCodeFileReaderService = new ClaudeCodeFileReaderService()

// Export factory function for consistency
export function createClaudeCodeFileReaderService(): ClaudeCodeFileReaderService {
  return claudeCodeFileReaderService
}