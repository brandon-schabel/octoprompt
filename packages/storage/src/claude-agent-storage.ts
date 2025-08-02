import * as fs from 'fs/promises'
import * as path from 'path'
import { z, ZodError } from 'zod'
import {
  ClaudeAgentSchema,
  type ClaudeAgent
} from '@promptliano/schemas'
import { toPosixPath, joinPosix, MarkdownParser } from '@promptliano/services'

// Storage schemas
export const ClaudeAgentsStorageSchema = z.record(z.string(), ClaudeAgentSchema)
export type ClaudeAgentsStorage = z.infer<typeof ClaudeAgentsStorageSchema>

interface AgentFrontmatter {
  name: string
  description: string
  color?: string
}

// Cache for parsed agents
interface AgentCache {
  agents: ClaudeAgentsStorage
  timestamp: number
}

const agentCache = new Map<string, AgentCache>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const claudeAgentStorage = {
  /** Parse agent markdown file using markdown parser */
  async parseAgentFile(content: string, filePath?: string): Promise<{ frontmatter: AgentFrontmatter; body: string }> {
    try {
      const parser = new MarkdownParser<AgentFrontmatter>({
        matterOptions: {
          // Use a more lenient parser for frontmatter
          engines: {
            yaml: (str: string) => {
              // Simple parser that extracts key-value pairs
              const result: any = {}
              const lines = str.split('\n')
              for (const line of lines) {
                const colonIndex = line.indexOf(':')
                if (colonIndex > 0) {
                  const key = line.substring(0, colonIndex).trim()
                  const value = line.substring(colonIndex + 1).trim()
                  if (key === 'description') {
                    // Handle multi-line descriptions
                    result[key] = value.replace(/\\n/g, '\n')
                  } else {
                    result[key] = value
                  }
                }
              }
              return result
            }
          }
        }
      })
      const result = await parser.parse(content, filePath)
      
      // Validate required fields
      if (!result.frontmatter.name) {
        throw new Error('Invalid agent file: missing name in frontmatter')
      }
      
      return { frontmatter: result.frontmatter, body: result.body }
    } catch (error) {
      // Fall back to the simple regex parser if markdown parser fails
      const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/
      const match = content.match(FRONTMATTER_REGEX)
      if (!match) {
        throw new Error('Invalid agent file format: missing frontmatter')
      }

      const [, frontmatterStr, body] = match
      const frontmatter: AgentFrontmatter = {
        name: '',
        description: ''
      }

      // Parse frontmatter line by line
      const lines = frontmatterStr.split('\n')
      for (const line of lines) {
        const colonIndex = line.indexOf(':')
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim()
          const value = line.substring(colonIndex + 1).trim()
          if (key === 'name') frontmatter.name = value
          else if (key === 'description') frontmatter.description = value.replace(/\\n/g, '\n')
          else if (key === 'color') frontmatter.color = value
        }
      }

      if (!frontmatter.name) {
        throw new Error('Invalid agent file: missing name in frontmatter')
      }

      return { frontmatter, body: body.trim() }
    }
  },

  /** Generate agent markdown content from data */
  generateAgentContent(agent: Partial<ClaudeAgent>): string {
    const frontmatter = [
      '---',
      `name: ${agent.name || 'Untitled Agent'}`,
      `description: ${(agent.description || '').replace(/\n/g, '\\n')}`,
      agent.color ? `color: ${agent.color}` : '',
      '---'
    ]
      .filter(Boolean)
      .join('\n')

    return `${frontmatter}\n\n${agent.content || ''}`
  },

  /** Get the agents directory path for a project */
  getAgentsDir(projectPath: string): string {
    return path.join(projectPath, '.claude', 'agents')
  },

  /** Ensure agents directory exists */
  async ensureAgentsDir(projectPath: string): Promise<void> {
    const agentsDir = this.getAgentsDir(projectPath)
    await fs.mkdir(agentsDir, { recursive: true })
  },

  /** Read all agents from filesystem for a project with caching */
  async readAgents(projectPath: string): Promise<ClaudeAgentsStorage> {
    // Check cache first
    const cacheKey = projectPath
    const cached = agentCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.agents
    }

    try {
      await this.ensureAgentsDir(projectPath)
      const agentsDir = this.getAgentsDir(projectPath)

      const files = await fs.readdir(agentsDir)
      const agents: ClaudeAgentsStorage = {}

      for (const file of files) {
        if (!file.endsWith('.md')) continue

        const filePath = path.join(agentsDir, file)
        const content = await fs.readFile(filePath, 'utf-8')

        try {
          const { frontmatter, body } = await this.parseAgentFile(content, filePath)
          const stats = await fs.stat(filePath)

          // Generate ID from filename (without .md extension)
          const agentId = file.slice(0, -3)

          // Generate a stable numeric ID from the string agentId
          // This ensures consistency across reads
          const numericId =
            agentId.split('').reduce((acc, char) => {
              return acc + char.charCodeAt(0)
            }, 0) *
              1000 +
            agentId.length

          const agent: ClaudeAgent = {
            id: numericId, // Stable ID based on filename
            name: frontmatter.name,
            description: frontmatter.description,
            color: (frontmatter.color as any) || 'blue',
            filePath: toPosixPath(filePath),
            content: body,
            created: stats.birthtime.getTime(),
            updated: stats.mtime.getTime()
          }

          agents[agentId] = agent
        } catch (error) {
          console.error(`Error parsing agent file ${file}:`, error)
        }
      }

      // Update cache
      agentCache.set(cacheKey, { agents, timestamp: Date.now() })

      return agents
    } catch (error) {
      console.error('Error reading agents:', error)
      return {}
    }
  },

  /** Write a single agent to filesystem */
  async writeAgent(projectPath: string, agentId: string, agent: ClaudeAgent): Promise<ClaudeAgent> {
    await this.ensureAgentsDir(projectPath)

    const filename = `${agentId}.md`
    const filePath = path.join(this.getAgentsDir(projectPath), filename)
    const content = this.generateAgentContent(agent)

    await fs.writeFile(filePath, content, 'utf-8')

    // Update the agent with the correct file path
    agent.filePath = toPosixPath(filePath)
    agent.updated = Date.now()

    // Clear cache for this project
    agentCache.delete(projectPath)

    return agent
  },

  /** Delete an agent file */
  async deleteAgent(projectPath: string, agentId: string): Promise<boolean> {
    try {
      const filename = `${agentId}.md`
      const filePath = path.join(this.getAgentsDir(projectPath), filename)

      await fs.unlink(filePath)
      
      // Clear cache for this project
      agentCache.delete(projectPath)
      
      return true
    } catch (error) {
      console.error('Error deleting agent:', error)
      return false
    }
  },

  /** Get a specific agent by ID */
  async getAgentById(projectPath: string, agentId: string): Promise<ClaudeAgent | null> {
    const agents = await this.readAgents(projectPath)
    return agents[agentId] || null
  },

  /** List all available agent colors from existing agents */
  async getAvailableColors(projectPath: string): Promise<string[]> {
    const agents = await this.readAgents(projectPath)
    const colors = new Set<string>()

    for (const agent of Object.values(agents)) {
      if (agent && agent.color) {
        colors.add(agent.color)
      }
    }

    return Array.from(colors)
  },

  /** Generate a unique agent ID */
  generateAgentId(name: string): string {
    // Create a URL-safe ID from the name
    const baseId = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Add timestamp for uniqueness
    return `${baseId}-${Date.now()}`
  },

  /** Clear the agent cache */
  clearCache(projectPath?: string): void {
    if (projectPath) {
      agentCache.delete(projectPath)
    } else {
      agentCache.clear()
    }
  }
}
