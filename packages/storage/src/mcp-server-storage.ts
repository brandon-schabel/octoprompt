import { z, ZodError, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises'

// Define the base directory for storing MCP server data
const DATA_DIR = path.resolve(process.cwd(), 'data', 'mcp_server_storage')

// --- Schemas ---
const unixTimestampSchema = z.number().int().positive()

export const McpServerConfigSchema = z.object({
  id: z.number(),
  name: z.string(),
  projectId: z.number(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  created: unixTimestampSchema,
  updated: unixTimestampSchema,
})

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>

export const McpServerStateSchema = z.object({
  id: z.number(),
  serverId: z.number(),
  status: z.enum(['running', 'stopped', 'error']),
  pid: z.number().optional(),
  startedAt: unixTimestampSchema.optional(),
  stoppedAt: unixTimestampSchema.optional(),
  errorMessage: z.string().optional(),
  updated: unixTimestampSchema,
})

export type McpServerState = z.infer<typeof McpServerStateSchema>

// Storage Schemas
export const McpServerConfigsStorageSchema = z.record(z.string(), McpServerConfigSchema)
export type McpServerConfigsStorage = z.infer<typeof McpServerConfigsStorageSchema>

export const McpServerStatesStorageSchema = z.record(z.string(), McpServerStateSchema)
export type McpServerStatesStorage = z.infer<typeof McpServerStatesStorageSchema>

// --- Path Helpers ---
function getMcpServerConfigsPath(): string {
  return path.join(DATA_DIR, 'mcp_server_configs.json')
}

function getMcpServerStatesPath(): string {
  return path.join(DATA_DIR, 'mcp_server_states.json')
}

// --- Core Read/Write Functions ---
async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      console.error(`Error creating directory ${dirPath}:`, error)
      throw new Error(`Failed to ensure directory exists: ${dirPath}`)
    }
  }
}

async function readValidatedJson<T extends ZodTypeAny>(
  filePath: string,
  schema: T,
  defaultValue: z.infer<T>
): Promise<z.infer<T>> {
  try {
    await ensureDirExists(path.dirname(filePath))
    const fileContent = await fs.readFile(filePath, 'utf-8')

    if (fileContent.trim() === '') {
      console.warn(`File is empty or contains only whitespace: ${filePath}. Returning default value.`)
      return defaultValue
    }

    const jsonData = JSON.parse(fileContent)
    const validationResult = await schema.safeParseAsync(jsonData)
    
    if (!validationResult.success) {
      console.error(`Zod validation failed reading ${filePath}:`, validationResult.error.errors)
      console.warn(`Returning default value due to validation failure for ${filePath}.`)
      return defaultValue
    }
    return validationResult.data
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return defaultValue
    }
    if (error instanceof SyntaxError) {
      console.error(`JSON Parse error in ${filePath}:`, error.message)
      console.warn(`Returning default value due to JSON parsing error for ${filePath}.`)
      return defaultValue
    }
    console.error(`Error reading or parsing JSON from ${filePath}:`, error)
    throw new Error(`Failed to read/parse JSON file at ${filePath}. Reason: ${error.message}`)
  }
}

async function writeValidatedJson<T extends ZodTypeAny>(
  filePath: string,
  data: unknown,
  schema: T
): Promise<z.infer<T>> {
  try {
    const validationResult = await schema.safeParseAsync(data)
    if (!validationResult.success) {
      console.error(`Zod validation failed before writing to ${filePath}:`, validationResult.error.errors)
      throw new ZodError(validationResult.error.errors)
    }
    const validatedData = validationResult.data

    await ensureDirExists(path.dirname(filePath))
    const jsonString = JSON.stringify(validatedData, null, 2)
    await fs.writeFile(filePath, jsonString, 'utf-8')

    return validatedData
  } catch (error: any) {
    console.error(`Error writing JSON to ${filePath}:`, error)
    if (error instanceof ZodError) {
      throw error
    }
    throw new Error(`Failed to write JSON file at ${filePath}. Reason: ${error.message}`)
  }
}

// --- MCP Server Config Storage ---
export const mcpServerConfigStorage = {
  async readConfigs(): Promise<McpServerConfigsStorage> {
    return readValidatedJson(getMcpServerConfigsPath(), McpServerConfigsStorageSchema, {})
  },

  async writeConfigs(configs: McpServerConfigsStorage): Promise<McpServerConfigsStorage> {
    return writeValidatedJson(getMcpServerConfigsPath(), configs, McpServerConfigsStorageSchema)
  },

  async get(id: string): Promise<McpServerConfig | undefined> {
    const configs = await this.readConfigs()
    return configs[id]
  },

  async save(config: McpServerConfig): Promise<McpServerConfig> {
    const configs = await this.readConfigs()
    configs[String(config.id)] = config
    await this.writeConfigs(configs)
    return config
  },

  async update(id: string, updates: Partial<Omit<McpServerConfig, 'id' | 'created'>>): Promise<McpServerConfig | undefined> {
    const configs = await this.readConfigs()
    const existing = configs[id]
    if (!existing) {
      return undefined
    }
    
    const updated = {
      ...existing,
      ...updates,
      updated: Date.now()
    }
    
    configs[id] = updated
    await this.writeConfigs(configs)
    return updated
  },

  async delete(id: string): Promise<boolean> {
    const configs = await this.readConfigs()
    if (configs[id]) {
      delete configs[id]
      await this.writeConfigs(configs)
      return true
    }
    return false
  },

  generateId: (): number => {
    return Date.now()
  }
}

// --- MCP Server State Storage ---
export const mcpServerStateStorage = {
  async readStates(): Promise<McpServerStatesStorage> {
    return readValidatedJson(getMcpServerStatesPath(), McpServerStatesStorageSchema, {})
  },

  async writeStates(states: McpServerStatesStorage): Promise<McpServerStatesStorage> {
    return writeValidatedJson(getMcpServerStatesPath(), states, McpServerStatesStorageSchema)
  },

  async get(id: string): Promise<McpServerState | undefined> {
    const states = await this.readStates()
    return states[id]
  },

  async save(state: McpServerState): Promise<McpServerState> {
    const states = await this.readStates()
    states[String(state.id)] = state
    await this.writeStates(states)
    return state
  },

  async update(id: string, updates: Partial<Omit<McpServerState, 'id'>>): Promise<McpServerState | undefined> {
    const states = await this.readStates()
    const existing = states[id]
    if (!existing) {
      return undefined
    }
    
    const updated = {
      ...existing,
      ...updates,
      updated: Date.now()
    }
    
    states[id] = updated
    await this.writeStates(states)
    return updated
  },

  async delete(id: string): Promise<boolean> {
    const states = await this.readStates()
    if (states[id]) {
      delete states[id]
      await this.writeStates(states)
      return true
    }
    return false
  },

  generateId: (): number => {
    return Date.now()
  }
}