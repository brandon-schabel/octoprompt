import * as fs from 'fs/promises'
import * as path from 'path'
import { z, ZodError } from 'zod'
import {
  ClaudeAgentSchema,
  ClaudeAgentProjectSchema,
  type ClaudeAgent,
  type ClaudeAgentProject
} from '@promptliano/schemas'
import { DatabaseManager, getDb } from './database-manager'

// Storage schemas
export const ClaudeAgentsStorageSchema = z.record(z.string(), ClaudeAgentSchema)
export type ClaudeAgentsStorage = z.infer<typeof ClaudeAgentsStorageSchema>

export const ClaudeAgentProjectsStorageSchema = z.array(ClaudeAgentProjectSchema)
export type ClaudeAgentProjectsStorage = z.infer<typeof ClaudeAgentProjectsStorageSchema>

// Frontmatter parsing regex
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

interface AgentFrontmatter {
  name: string
  description: string
  color?: string
}

export const claudeAgentStorage = {
  /** Parse agent markdown file to extract frontmatter and content */
  parseAgentFile(content: string): { frontmatter: AgentFrontmatter; body: string } {
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
      const [key, ...valueParts] = line.split(':')
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim()
        if (key === 'name') frontmatter.name = value
        else if (key === 'description') frontmatter.description = value.replace(/\\n/g, '\n')
        else if (key === 'color') frontmatter.color = value
      }
    }

    if (!frontmatter.name) {
      throw new Error('Invalid agent file: missing name in frontmatter')
    }

    return { frontmatter, body: body.trim() }
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

  /** Read all agents from filesystem for a project */
  async readAgents(projectPath: string): Promise<ClaudeAgentsStorage> {
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
          const { frontmatter, body } = this.parseAgentFile(content)
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
            filePath,
            content: body,
            created: stats.birthtime.getTime(),
            updated: stats.mtime.getTime()
          }

          agents[agentId] = agent
        } catch (error) {
          console.error(`Error parsing agent file ${file}:`, error)
        }
      }

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
    agent.filePath = filePath
    agent.updated = Date.now()

    return agent
  },

  /** Delete an agent file */
  async deleteAgent(projectPath: string, agentId: string): Promise<boolean> {
    try {
      const filename = `${agentId}.md`
      const filePath = path.join(this.getAgentsDir(projectPath), filename)

      await fs.unlink(filePath)
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

  // Database operations for agent-project associations

  /** Read all agent-project associations */
  async readAgentProjects(): Promise<ClaudeAgentProjectsStorage> {
    const db = getDb()
    const associationsMap = await db.getAll<ClaudeAgentProject>('agent_projects')
    const agentProjects = Array.from(associationsMap.values())

    const validationResult = ClaudeAgentProjectsStorageSchema.safeParse(agentProjects)
    if (!validationResult.success) {
      console.error('Validation failed reading agent-projects:', validationResult.error.errors)
      return []
    }

    return validationResult.data
  },

  /** Add agent-project association */
  async addAgentProjectAssociation(agentId: number, projectId: number): Promise<ClaudeAgentProject> {
    const db = getDb()
    const compositeId = `${agentId}_${projectId}`

    const association: ClaudeAgentProject = {
      id: Date.now(),
      agentId,
      projectId
    }

    const validatedAssociation = ClaudeAgentProjectSchema.parse(association)
    const now = Date.now()
    const database = db.getDatabase()

    const existsQuery = database.prepare(`SELECT 1 FROM agent_projects WHERE id = ? LIMIT 1`)
    const existingRow = existsQuery.get(compositeId)

    if (existingRow) {
      const updateQuery = database.prepare(`
        UPDATE agent_projects
        SET data = ?, updated_at = ?
        WHERE id = ?
      `)
      updateQuery.run(JSON.stringify(validatedAssociation), now, compositeId)
    } else {
      const insertQuery = database.prepare(`
        INSERT INTO agent_projects (id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
      insertQuery.run(compositeId, JSON.stringify(validatedAssociation), now, now)
    }

    return validatedAssociation
  },

  /** Remove agent-project association */
  async removeAgentProjectAssociation(agentId: number, projectId: number): Promise<boolean> {
    const db = getDb()
    const compositeId = `${agentId}_${projectId}`
    return await db.delete('agent_projects', compositeId)
  },

  /** Get all agents associated with a project */
  async getAgentsByProjectId(projectPath: string, projectId: number): Promise<ClaudeAgent[]> {
    const db = getDb()
    const associations = await db.findByJsonField<ClaudeAgentProject>('agent_projects', '$.projectId', projectId)
    const allAgents = await this.readAgents(projectPath)

    const agents: ClaudeAgent[] = []
    for (const assoc of associations) {
      const agentKey = Object.keys(allAgents).find((key) => {
        const agent = allAgents[key]
        return agent.id === assoc.agentId
      })

      if (agentKey && allAgents[agentKey]) {
        agents.push({
          ...allAgents[agentKey],
          projectId
        })
      }
    }

    return agents
  }
}
