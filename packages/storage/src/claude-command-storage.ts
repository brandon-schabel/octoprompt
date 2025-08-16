import * as fs from 'fs/promises'
import * as path from 'path'
import { z } from 'zod'
import {
  ClaudeCommandSchema,
  type ClaudeCommand,
  type CommandScope,
  type ClaudeCommandFrontmatter
} from '@promptliano/schemas'
import { toPosixPath, ClaudeCommandParser } from '@promptliano/shared'
// import { SecurePathValidator } from '@promptliano/shared' // TODO: SecurePathValidator not implemented yet
import { ensureString, ensureNumber, toNumber } from '@promptliano/shared/src/utils/sqlite-converters'
import { homedir } from 'os'

// Storage schema for commands (indexed by command key)
export const ClaudeCommandsStorageSchema = z.record(z.string(), ClaudeCommandSchema)
export type ClaudeCommandsStorage = z.infer<typeof ClaudeCommandsStorageSchema>

// File watcher state
interface FileWatcherState {
  watcher?: any // FSWatcher type
  lastScan?: number
}

export const claudeCommandStorage = {
  // Path validator instance
  // pathValidator: new SecurePathValidator(), // TODO: SecurePathValidator not implemented yet

  // Initialize path validator with allowed directories
  initializePathValidator(projectPath?: string) {
    // TODO: SecurePathValidator not implemented yet
    // // Always allow user commands directory
    // this.pathValidator.addAllowedPath(this.getUserCommandsDir())
    //
    // // Add project path if provided
    // if (projectPath) {
    //   this.pathValidator.addAllowedPath(projectPath)
    // }
  },

  // Watch state
  watcherState: new Map<string, FileWatcherState>(),

  // Cache for parsed commands
  commandCache: new Map<string, { commands: ClaudeCommandsStorage; timestamp: number }>(),
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes

  /** Get project commands directory */
  getProjectCommandsDir(projectPath: string): string {
    return path.join(projectPath, '.claude', 'commands')
  },

  /** Get user global commands directory */
  getUserCommandsDir(): string {
    return path.join(homedir(), '.claude', 'commands')
  },

  /** Ensure commands directory exists */
  async ensureCommandsDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true })
  },

  /** Generate command key from file path and scope */
  generateCommandKey(commandName: string, namespace?: string, scope?: CommandScope): string {
    const parts = [(scope || 'project') as string]
    if (namespace) parts.push(namespace)
    parts.push(commandName)
    return parts.join(':')
  },

  /** Parse command key into components */
  parseCommandKey(key: string): { scope: CommandScope; namespace?: string; commandName: string } {
    const parts = key.split(':')
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { scope: parts[0] as CommandScope, commandName: parts[1] }
    } else if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      return { scope: parts[0] as CommandScope, namespace: parts[1], commandName: parts[2] }
    }
    throw new Error(`Invalid command key format: ${key}`)
  },

  /** Read all commands from a directory */
  async readCommandsFromDir(dirPath: string, scope: CommandScope): Promise<ClaudeCommandsStorage> {
    // TODO: SecurePathValidator not implemented yet - skipping validation
    // // Validate base directory path
    // const dirValidation = this.pathValidator.validatePath(dirPath)
    // if (!dirValidation.valid) {
    //   console.error(`Invalid commands directory path: ${dirValidation.error}`)
    //   return {}
    // }

    const commands: ClaudeCommandsStorage = {}
    const parser = new ClaudeCommandParser()

    try {
      await this.ensureCommandsDir(dirPath)

      // Recursively read all .md files
      const readDir = async (currentPath: string, namespace?: string): Promise<void> => {
        const entries = await fs.readdir(currentPath, { withFileTypes: true })

        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry.name)

          if (entry.isDirectory()) {
            // Recurse into subdirectory with namespace
            const newNamespace = namespace ? `${namespace}/${entry.name}` : entry.name
            await readDir(entryPath, newNamespace)
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            try {
              // TODO: SecurePathValidator not implemented yet - skipping validation
              // // Validate file path before reading
              // const fileValidation = this.pathValidator.validatePath(entryPath, dirPath)
              // if (!fileValidation.valid) {
              //   console.error(`Skipping invalid file path: ${entryPath} - ${fileValidation.error}`)
              //   continue
              // }

              // Read and parse command file
              const content = await fs.readFile(entryPath, 'utf-8')
              const parseResult = await parser.parse(content, entryPath)
              const stats = await fs.stat(entryPath)

              // Extract command name without .md extension
              const commandName = entry.name.slice(0, -3)

              // Generate command key
              const key = this.generateCommandKey(commandName, namespace, scope)

              // Create preliminary command object with conversion utilities
              const preliminary: Partial<ClaudeCommand> = {
                id: ensureNumber(stats.birthtime.getTime()),
                name: ensureString(commandName),
                namespace: namespace || undefined,
                scope: scope,
                description: ensureString(parseResult.frontmatter.description || ''),
                filePath: toPosixPath(entryPath),
                content: ensureString(parseResult.body || ''),
                frontmatter: parseResult.frontmatter as any,
                created: ensureNumber(stats.birthtime.getTime()),
                updated: ensureNumber(stats.mtime.getTime())
              }

              // Validate with schema for stronger type safety
              const validation = await ClaudeCommandSchema.safeParseAsync(preliminary)
              if (!validation.success) {
                console.error(`Validation failed for command ${commandName}:`, validation.error.issues)
              } else {
                commands[key] = validation.data
              }
            } catch (error) {
              console.error(`Error parsing command file ${entryPath}:`, error)
            }
          }
        }
      }

      await readDir(dirPath)
    } catch (error) {
      console.error(`Error reading commands from ${dirPath}:`, error)
    }

    return commands
  },

  /** Read all commands for a project (including user global commands) */
  async readCommands(projectPath: string, includeGlobal: boolean = true): Promise<ClaudeCommandsStorage> {
    // Initialize path validator with project path
    this.initializePathValidator(projectPath)

    const cacheKey = `${projectPath}:${includeGlobal}`

    // Check cache
    const cached = this.commandCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.commands
    }

    const commands: ClaudeCommandsStorage = {}

    // Read project commands
    const projectDir = this.getProjectCommandsDir(projectPath)
    const projectCommands = await this.readCommandsFromDir(projectDir, 'project')
    Object.assign(commands, projectCommands)

    // Read user global commands if requested
    if (includeGlobal) {
      const userDir = this.getUserCommandsDir()
      const userCommands = await this.readCommandsFromDir(userDir, 'user')
      Object.assign(commands, userCommands)
    }

    // Update cache
    this.commandCache.set(cacheKey, { commands, timestamp: Date.now() })

    return commands
  },

  /** Get a specific command by name */
  async getCommandByName(
    projectPath: string,
    commandName: string,
    namespace?: string,
    scope?: CommandScope
  ): Promise<ClaudeCommand | null> {
    const commands = await this.readCommands(projectPath)

    // Try exact match first
    if (scope) {
      const key = this.generateCommandKey(commandName, namespace, scope)
      if (commands[key]) return commands[key]
    }

    // Try to find by name and namespace (any scope)
    for (const [key, command] of Object.entries(commands)) {
      if (command.name === commandName && (namespace === undefined || command.namespace === namespace)) {
        return command
      }
    }

    return null
  },

  /** Write a command file */
  async writeCommand(
    projectPath: string,
    commandName: string,
    content: string,
    frontmatter: ClaudeCommandFrontmatter,
    namespace?: string,
    scope: CommandScope = 'project'
  ): Promise<ClaudeCommand> {
    // Initialize path validator with project path
    this.initializePathValidator(projectPath)

    // TODO: SecurePathValidator not implemented yet - skipping validation
    // // Validate command name
    // const nameValidation = this.pathValidator.validateCommandName(commandName)
    // if (!nameValidation.valid) {
    //   throw new Error(`Invalid command name: ${nameValidation.error}`)
    // }

    // TODO: SecurePathValidator not implemented yet - skipping validation
    // // Validate namespace if provided
    // if (namespace) {
    //   const namespaceValidation = this.pathValidator.validateNamespace(namespace)
    //   if (!namespaceValidation.valid) {
    //     throw new Error(`Invalid namespace: ${namespaceValidation.error}`)
    //   }
    // }

    // Determine directory based on scope
    const baseDir = scope === 'project' ? this.getProjectCommandsDir(projectPath) : this.getUserCommandsDir()

    // TODO: SecurePathValidator not implemented yet - skipping validation
    // // Validate base directory
    // const baseDirValidation = this.pathValidator.validatePath(baseDir)
    // if (!baseDirValidation.valid) {
    //   throw new Error(`Invalid base directory: ${baseDirValidation.error}`)
    // }

    // Create full directory path with namespace
    const dirPath = namespace ? path.join(baseDir, ...namespace.split('/')) : baseDir

    // TODO: SecurePathValidator not implemented yet - skipping validation
    // // Validate the full directory path
    // const dirValidation = this.pathValidator.validatePath(dirPath, projectPath)
    // if (!dirValidation.valid) {
    //   throw new Error(`Invalid directory path: ${dirValidation.error}`)
    // }

    await this.ensureCommandsDir(dirPath)

    // Create file path
    const fileName = `${commandName}.md`
    const filePath = path.join(dirPath, fileName)

    // TODO: SecurePathValidator not implemented yet - skipping validation
    // // Final validation of the complete file path
    // const fileValidation = this.pathValidator.validatePath(filePath, projectPath)
    // if (!fileValidation.valid) {
    //   throw new Error(`Invalid file path: ${fileValidation.error}`)
    // }

    // Generate markdown content with frontmatter
    const fullContent = this.generateCommandContent(content, frontmatter)

    // Write file
    await fs.writeFile(filePath, fullContent, 'utf-8')

    // Clear cache
    this.clearCache(projectPath)

    // Return the created command
    const stats = await fs.stat(filePath)
    const preliminary: Partial<ClaudeCommand> = {
      id: ensureNumber(stats.birthtime.getTime()),
      name: ensureString(commandName),
      namespace: namespace || undefined,
      scope,
      description: ensureString(frontmatter.description || ''),
      filePath: toPosixPath(filePath),
      content: ensureString(content),
      frontmatter: frontmatter as any,
      created: ensureNumber(stats.birthtime.getTime()),
      updated: ensureNumber(stats.mtime.getTime())
    }

    const validation = await ClaudeCommandSchema.safeParseAsync(preliminary)
    if (!validation.success) {
      throw new Error(`Validation failed for command ${commandName}: ${validation.error.message}`)
    }
    return validation.data
  },

  /** Generate command markdown content with frontmatter */
  generateCommandContent(body: string, frontmatter: ClaudeCommandFrontmatter): string {
    const frontmatterLines: string[] = ['---']

    // Add frontmatter fields
    if (frontmatter.description) {
      frontmatterLines.push(`description: ${frontmatter.description}`)
    }
    if (frontmatter['allowed-tools']) {
      frontmatterLines.push(`allowed-tools: ${frontmatter['allowed-tools']}`)
    }
    if (frontmatter['argument-hint']) {
      frontmatterLines.push(`argument-hint: ${frontmatter['argument-hint']}`)
    }
    if (frontmatter.model) {
      frontmatterLines.push(`model: ${frontmatter.model}`)
    }
    if (frontmatter['max-turns']) {
      frontmatterLines.push(`max-turns: ${frontmatter['max-turns']}`)
    }
    if (frontmatter['output-format']) {
      frontmatterLines.push(`output-format: ${frontmatter['output-format']}`)
    }

    frontmatterLines.push('---', '')

    return frontmatterLines.join('\n') + body
  },

  /** Delete a command file */
  async deleteCommand(
    projectPath: string,
    commandName: string,
    namespace?: string,
    scope: CommandScope = 'project'
  ): Promise<boolean> {
    try {
      const command = await this.getCommandByName(projectPath, commandName, namespace, scope)
      if (!command) return false

      // TODO: SecurePathValidator not implemented yet - skipping validation
      // // Validate the file path before deletion
      // const fileValidation = this.pathValidator.validatePath(command.filePath, projectPath)
      // if (!fileValidation.valid) {
      //   throw new Error(`Cannot delete file - invalid path: ${fileValidation.error}`)
      // }

      await fs.unlink(command.filePath)

      // Clear cache
      this.clearCache(projectPath)

      return true
    } catch (error) {
      console.error('Error deleting command:', error)
      return false
    }
  },

  /** Clear command cache */
  clearCache(projectPath?: string): void {
    if (projectPath) {
      // Clear specific project cache
      const keysToDelete: string[] = []
      for (const key of this.commandCache.keys()) {
        if (key.startsWith(projectPath)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach((key) => this.commandCache.delete(key))
    } else {
      // Clear all cache
      this.commandCache.clear()
    }
  },

  /** Set up file watcher for a directory */
  async watchDirectory(dirPath: string, onChange: () => void): Promise<void> {
    // Implementation would use fs.watch or chokidar
    // For now, this is a placeholder
    console.log(`Would watch directory: ${dirPath}`)
  },

  /** Stop watching a directory */
  async unwatchDirectory(dirPath: string): Promise<void> {
    const state = this.watcherState.get(dirPath)
    if (state?.watcher) {
      // Close watcher
      this.watcherState.delete(dirPath)
    }
  }
}
