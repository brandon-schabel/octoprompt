import { z, ZodError } from 'zod'
import { PromptSchema, PromptProjectSchema, type Prompt, type PromptProject } from '@octoprompt/schemas'
import { DatabaseManager, getDb } from './database-manager'

// --- Schemas for Storage ---
// Store all prompts (metadata) as a map (Record) keyed by promptId
export const PromptsStorageSchema = z.record(z.string(), PromptSchema)
export type PromptsStorage = z.infer<typeof PromptsStorageSchema>

// Store all prompt-project associations
export const PromptProjectsStorageSchema = z.array(PromptProjectSchema)
export type PromptProjectsStorage = z.infer<typeof PromptProjectsStorageSchema>

// --- Specific Data Accessors ---

export const promptStorage = {
  /** Reads all prompts from the database. */
  async readPrompts(): Promise<PromptsStorage> {
    const db = getDb()
    const promptsMap = await db.getAll<Prompt>('prompts')

    // Convert Map to PromptsStorage (Record)
    const prompts: PromptsStorage = {}
    for (const [id, prompt] of promptsMap) {
      prompts[String(id)] = prompt
    }

    // Validate the result
    const validationResult = PromptsStorageSchema.safeParse(prompts)
    if (!validationResult.success) {
      console.error('Validation failed reading prompts from database:', validationResult.error.errors)
      return {}
    }

    return validationResult.data
  },

  /** Writes all prompts to the database (replaces entire collection). */
  async writePrompts(prompts: PromptsStorage): Promise<PromptsStorage> {
    const db = getDb()

    // Validate input
    const validationResult = PromptsStorageSchema.safeParse(prompts)
    if (!validationResult.success) {
      console.error('Validation failed before writing prompts to database:', validationResult.error.errors)
      throw new ZodError(validationResult.error.errors)
    }

    const validatedPrompts = validationResult.data

    // Use transaction to ensure atomicity
    db.transaction(() => {
      // Clear existing prompts - synchronous in transaction
      db.getDatabase().exec(`DELETE FROM prompts`)

      // Insert all prompts - synchronous in transaction
      const insertStmt = db.getDatabase().prepare(`
        INSERT INTO prompts (id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)

      for (const [id, prompt] of Object.entries(validatedPrompts)) {
        const now = Date.now()
        insertStmt.run(id, JSON.stringify(prompt), now, now)
      }
    })

    return validatedPrompts
  },

  /** Reads all prompt-project associations from the database. */
  async readPromptProjects(): Promise<PromptProjectsStorage> {
    const db = getDb()
    const associationsMap = await db.getAll<PromptProject>('prompt_projects')

    // Convert Map values to array
    const promptProjects = Array.from(associationsMap.values())

    // Validate the result
    const validationResult = PromptProjectsStorageSchema.safeParse(promptProjects)
    if (!validationResult.success) {
      console.error('Validation failed reading prompt-projects from database:', validationResult.error.errors)
      return []
    }

    return validationResult.data
  },

  /** Writes all prompt-project associations to the database (replaces entire collection). */
  async writePromptProjects(promptProjects: PromptProjectsStorage): Promise<PromptProjectsStorage> {
    const db = getDb()

    // Validate input
    const validationResult = PromptProjectsStorageSchema.safeParse(promptProjects)
    if (!validationResult.success) {
      console.error('Validation failed before writing prompt-projects to database:', validationResult.error.errors)
      throw new ZodError(validationResult.error.errors)
    }

    const validatedAssociations = validationResult.data

    // Use transaction to ensure atomicity
    db.transaction(() => {
      // Clear existing associations - synchronous in transaction
      db.getDatabase().exec(`DELETE FROM prompt_projects`)

      // Insert all associations - synchronous in transaction
      const insertStmt = db.getDatabase().prepare(`
        INSERT INTO prompt_projects (id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)

      for (const association of validatedAssociations) {
        const compositeId = `${association.promptId}_${association.projectId}`
        const now = Date.now()
        insertStmt.run(compositeId, JSON.stringify(association), now, now)
      }
    })

    return validatedAssociations
  },

  /** Gets a specific prompt by ID. */
  async getPromptById(promptId: number): Promise<Prompt | null> {
    const db = getDb()
    return await db.get<Prompt>('prompts', String(promptId))
  },

  /** Creates or updates a prompt. */
  async upsertPrompt(prompt: Prompt): Promise<Prompt> {
    const db = getDb()

    // Validate the prompt
    const validatedPrompt = PromptSchema.parse(prompt)
    const id = String(validatedPrompt.id)

    // Use the database directly for better control
    const now = Date.now()
    const database = db.getDatabase()

    // Check if exists
    const existsQuery = database.prepare(`SELECT 1 FROM prompts WHERE id = ? LIMIT 1`)
    const existingRow = existsQuery.get(id)

    if (existingRow) {
      // Update
      const updateQuery = database.prepare(`
        UPDATE prompts
        SET data = ?, updated_at = ?
        WHERE id = ?
      `)
      updateQuery.run(JSON.stringify(validatedPrompt), now, id)
    } else {
      // Insert
      const insertQuery = database.prepare(`
        INSERT INTO prompts (id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
      insertQuery.run(id, JSON.stringify(validatedPrompt), now, now)
    }

    return validatedPrompt
  },

  /** Deletes a prompt and its associations. */
  async deletePrompt(promptId: number): Promise<boolean> {
    const db = getDb()

    // First check if prompt exists
    const exists = await db.exists('prompts', String(promptId))
    if (!exists) {
      return false
    }

    // Find all associations for this prompt
    const associations = await db.findByJsonField<PromptProject>(
      'prompt_projects',
      '$.promptId',
      promptId
    )

    // Use transaction for deletion
    return db.transaction(async () => {
      // Delete the prompt
      const deleted = await db.delete('prompts', String(promptId))

      if (deleted) {
        // Delete all associations for this prompt
        for (const assoc of associations) {
          const compositeId = `${assoc.promptId}_${assoc.projectId}`
          await db.delete('prompt_projects', compositeId)
        }
      }

      return deleted
    })
  },

  /** Gets all prompts associated with a project. */
  async getPromptsByProjectId(projectId: number): Promise<Prompt[]> {
    const db = getDb()

    // Find all associations for this project
    const associations = await db.findByJsonField<PromptProject>(
      'prompt_projects',
      '$.projectId',
      projectId
    )

    // Get all unique prompt IDs
    const promptIds = [...new Set(associations.map(a => a.promptId))]

    // Fetch all prompts
    const prompts: Prompt[] = []
    for (const promptId of promptIds) {
      const prompt = await db.get<Prompt>('prompts', String(promptId))
      if (prompt) {
        prompts.push(prompt)
      }
    }

    return prompts
  },

  /** Adds or updates a prompt-project association. */
  async addPromptProjectAssociation(promptId: number, projectId: number): Promise<PromptProject> {
    const db = getDb()
    const compositeId = `${promptId}_${projectId}`

    const association: PromptProject = {
      id: Date.now(), // Add the required id field
      promptId,
      projectId
    }

    // Validate the association
    const validatedAssociation = PromptProjectSchema.parse(association)

    // Use the database directly for better control
    const now = Date.now()
    const database = db.getDatabase()

    // Check if exists
    const existsQuery = database.prepare(`SELECT 1 FROM prompt_projects WHERE id = ? LIMIT 1`)
    const existingRow = existsQuery.get(compositeId)

    if (existingRow) {
      // Update
      const updateQuery = database.prepare(`
        UPDATE prompt_projects
        SET data = ?, updated_at = ?
        WHERE id = ?
      `)
      updateQuery.run(JSON.stringify(validatedAssociation), now, compositeId)
    } else {
      // Insert
      const insertQuery = database.prepare(`
        INSERT INTO prompt_projects (id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
      insertQuery.run(compositeId, JSON.stringify(validatedAssociation), now, now)
    }

    return validatedAssociation
  },

  /** Removes a prompt-project association. */
  async removePromptProjectAssociation(promptId: number, projectId: number): Promise<boolean> {
    const db = getDb()
    const compositeId = `${promptId}_${projectId}`
    return await db.delete('prompt_projects', compositeId)
  },

  /** Generates a unique ID. */
  generateId: (): number => {
    const db = getDb()
    return db.generateUniqueId('prompts')
  }
}
