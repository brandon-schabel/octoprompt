// Recent changes:
// - Initial implementation of agent file detection service
// - Added platform-specific path resolution
// - Support for multiple AI agent configuration formats
// - Global and project-specific file detection
// - Added metadata extraction for each file type
// - Converted to use ErrorFactory pattern for consistent error handling

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { ErrorFactory, assertExists, withErrorContext } from './utils/error-factory'

export const DetectedAgentFileSchema = z.object({
  type: z.string(),
  name: z.string(),
  path: z.string(),
  scope: z.enum(['global', 'project']),
  exists: z.boolean(),
  writable: z.boolean(),
  content: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

export type DetectedAgentFile = z.infer<typeof DetectedAgentFileSchema>

export interface AgentFilePattern {
  type: string
  name: string
  patterns: {
    global?: string[]
    project: string[]
  }
  extractMetadata?: (content: string) => Record<string, any>
}

export class AgentFileDetectionService {
  private readonly patterns: AgentFilePattern[] = [
    {
      type: 'claude',
      name: 'Claude',
      patterns: {
        global: [path.join(os.homedir(), '.claude', 'CLAUDE.md'), path.join(os.homedir(), 'CLAUDE.md')],
        project: ['CLAUDE.md', '.claude/CLAUDE.md']
      }
    },
    {
      type: 'copilot',
      name: 'GitHub Copilot',
      patterns: {
        project: ['.github/copilot-instructions.md', 'copilot-instructions.md']
      }
    },
    {
      type: 'cursor',
      name: 'Cursor',
      patterns: {
        project: ['.cursorrules', '.cursor/rules.md']
      }
    },
    {
      type: 'aider',
      name: 'Aider',
      patterns: {
        global: [path.join(os.homedir(), '.aider.conf.yml')],
        project: ['.aider', '.aider.conf.yml', '.aider/aider.conf.yml']
      },
      extractMetadata: (content: string) => {
        // Extract YAML configuration if present
        const metadata: Record<string, any> = {}
        const modelMatch = content.match(/model:\s*(.+)/)
        if (modelMatch && modelMatch[1]) metadata.model = modelMatch[1].trim()
        return metadata
      }
    },
    {
      type: 'codebase',
      name: 'Codebase Instructions',
      patterns: {
        project: ['codebase-instructions.md', '.ai/instructions.md', 'AI_INSTRUCTIONS.md', 'docs/ai-instructions.md']
      }
    },
    {
      type: 'windsurf',
      name: 'Windsurf',
      patterns: {
        project: ['.windsurf/rules.md', '.windsurfrules']
      }
    },
    {
      type: 'continue',
      name: 'Continue',
      patterns: {
        global: [path.join(os.homedir(), '.continue', 'config.json')],
        project: ['.continue/config.json']
      },
      extractMetadata: (content: string) => {
        try {
          const config = JSON.parse(content)
          return {
            models: config.models?.map((m: any) => m.title || m.model) || []
          }
        } catch {
          return {}
        }
      }
    }
  ]

  async detectAllFiles(projectPath?: string): Promise<DetectedAgentFile[]> {
    const detectedFiles: DetectedAgentFile[] = []

    // Detect global files
    for (const pattern of this.patterns) {
      if (pattern.patterns.global) {
        for (const globalPath of pattern.patterns.global) {
          const file = await this.checkFile(globalPath, pattern, 'global')
          if (file) detectedFiles.push(file)
        }
      }
    }

    // Detect project files if project path provided
    if (projectPath) {
      for (const pattern of this.patterns) {
        for (const projectPattern of pattern.patterns.project) {
          const fullPath = path.join(projectPath, projectPattern)
          const file = await this.checkFile(fullPath, pattern, 'project')
          if (file) detectedFiles.push(file)
        }
      }
    }

    return detectedFiles
  }

  async detectProjectFiles(projectPath: string): Promise<DetectedAgentFile[]> {
    const detectedFiles: DetectedAgentFile[] = []

    for (const pattern of this.patterns) {
      for (const projectPattern of pattern.patterns.project) {
        const fullPath = path.join(projectPath, projectPattern)
        const file = await this.checkFile(fullPath, pattern, 'project')
        if (file) detectedFiles.push(file)
      }
    }

    return detectedFiles
  }

  async detectGlobalFiles(): Promise<DetectedAgentFile[]> {
    const detectedFiles: DetectedAgentFile[] = []

    for (const pattern of this.patterns) {
      if (pattern.patterns.global) {
        for (const globalPath of pattern.patterns.global) {
          const file = await this.checkFile(globalPath, pattern, 'global')
          if (file) detectedFiles.push(file)
        }
      }
    }

    return detectedFiles
  }

  private async checkFile(
    filePath: string,
    pattern: AgentFilePattern,
    scope: 'global' | 'project'
  ): Promise<DetectedAgentFile | null> {
    try {
      const stats = await fs.stat(filePath)

      if (!stats.isFile()) return null

      // Check if file is writable
      let writable = false
      try {
        await fs.access(filePath, fs.constants.W_OK)
        writable = true
      } catch {
        writable = false
      }

      // Read content for metadata extraction
      let content: string | undefined
      let metadata: Record<string, any> | undefined

      try {
        content = await fs.readFile(filePath, 'utf-8')
        if (pattern.extractMetadata && content) {
          metadata = pattern.extractMetadata(content)
        }
      } catch {
        // File exists but can't be read
      }

      return {
        type: pattern.type,
        name: pattern.name,
        path: filePath,
        scope,
        exists: true,
        writable,
        content,
        metadata
      }
    } catch {
      // File doesn't exist or can't be accessed
      return {
        type: pattern.type,
        name: pattern.name,
        path: filePath,
        scope,
        exists: false,
        writable: false
      }
    }
  }

  async createAgentFile(filePath: string, initialContent: string = ''): Promise<{ success: boolean; message: string }> {
    return withErrorContext(
      async () => {
        const dir = path.dirname(filePath)

        // Ensure directory exists
        try {
          await fs.mkdir(dir, { recursive: true })
        } catch (error) {
          throw ErrorFactory.fileSystemError('create directory', dir, error instanceof Error ? error.message : 'Unknown error')
        }

        // Check if file already exists
        try {
          await fs.access(filePath)
          throw ErrorFactory.duplicate('Agent file', 'path', filePath)
        } catch (error) {
          // If it's not our duplicate error, file doesn't exist - good to create
          if (error instanceof Error && (error as any).code === 'DUPLICATE_ENTITY') throw error
        }

        // Create the file
        try {
          await fs.writeFile(filePath, initialContent, 'utf-8')
        } catch (error) {
          throw ErrorFactory.fileSystemError('create file', filePath, error instanceof Error ? error.message : 'Unknown error')
        }

        return {
          success: true,
          message: 'Successfully created agent file'
        }
      },
      { entity: 'Agent File', action: 'create', id: filePath }
    ).catch(error => ({
      success: false,
      message: `Failed to create agent file: ${error instanceof Error ? error.message : 'Unknown error'}`
    }))
  }

  getSuggestedFiles(projectPath: string, existingFiles: DetectedAgentFile[]): (AgentFilePattern & { suggestedPath: string })[] {
    const existingTypes = new Set(existingFiles.map((f) => f.type))

    return this.patterns
      .filter((pattern) => !existingTypes.has(pattern.type))
      .map((pattern) => ({
        ...pattern,
        suggestedPath: path.join(projectPath, pattern.patterns.project[0] || '')
      }))
  }

  getFileTypeInfo(type: string): AgentFilePattern | undefined {
    return this.patterns.find((p) => p.type === type)
  }
}

export const agentFileDetectionService = new AgentFileDetectionService()
