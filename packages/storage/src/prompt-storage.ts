import { z, ZodError } from 'zod'
import { PromptSchema, PromptProjectSchema, type Prompt, type PromptProject } from '@promptliano/schemas'
import { DatabaseManager, getDb } from './database-manager'
import { ApiError } from '@promptliano/shared'
import { toNumber, SqliteConverters } from '@promptliano/shared/src/utils/sqlite-converters'

// --- Schemas for Storage ---
// Store all prompts (metadata) as a map (Record) keyed by promptId
export const PromptsStorageSchema = z.record(z.string(), PromptSchema)
export type PromptsStorage = z.infer<typeof PromptsStorageSchema>

// Store all prompt-project associations
export const PromptProjectsStorageSchema = z.array(PromptProjectSchema)
export type PromptProjectsStorage = z.infer<typeof PromptProjectsStorageSchema>

// --- Database Helper Functions ---

/**
 * Validates data against a schema and returns the validated data.
 */
async function validateData<T>(data: unknown, schema: z.ZodSchema<T>, context: string): Promise<T> {
  const validationResult = await schema.safeParseAsync(data)
  if (!validationResult.success) {
    console.error(`Zod validation failed for ${context}:`, validationResult.error.errors)
    throw new ApiError(400, `Validation failed for ${context}`, 'VALIDATION_ERROR')
  }
  return validationResult.data
}

// --- Specific Data Accessors ---

export const promptStorage = {
  /** Reads all prompts from the database. */
  async readPrompts(): Promise<PromptsStorage> {
    const db = getDb()
    const database = db.getDatabase()

    // Query prompts directly from columns
    const query = database.prepare(`
      SELECT id, name, content, project_id, created_at, updated_at
      FROM prompts
      ORDER BY created_at DESC
    `)

    const rows = query.all() as any[]

    // Convert rows to PromptsStorage
    const prompts: PromptsStorage = {}
    for (const row of rows) {
      const prompt: Prompt = {
        id: row.id,
        name: row.name,
        content: row.content,
        projectId: row.project_id,
        created: toNumber(row.created_at, Date.now()),
        updated: toNumber(row.updated_at, Date.now())
      }

      // Validate the result
      const validationResult = PromptSchema.safeParse(prompt)
      if (!validationResult.success) {
        console.error(`Skipping invalid prompt ${row.id}:`, validationResult.error.errors)
        continue
      }

      prompts[String(validationResult.data.id)] = validationResult.data
    }

    return prompts
  },

  /** Writes all prompts to the database (replaces entire collection). */
  async writePrompts(prompts: PromptsStorage): Promise<PromptsStorage> {
    const db = getDb()
    const database = db.getDatabase()

    // Validate input
    const validatedPrompts = await validateData(prompts, PromptsStorageSchema, 'prompts')

    // Use transaction to ensure atomicity
    database.transaction(() => {
      // Clear existing prompts
      database.exec(`DELETE FROM prompts`)

      // Insert all prompts
      const insertStmt = database.prepare(`
        INSERT INTO prompts (id, name, content, project_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      for (const [id, prompt] of Object.entries(validatedPrompts)) {
        const now = Date.now()
        insertStmt.run(
          prompt.id,
          prompt.name,
          prompt.content,
          prompt.projectId || null,
          prompt.created || now,
          prompt.updated || now
        )
      }
    })()

    return validatedPrompts
  },

  /** Reads all prompt-project associations from the database. */
  async readPromptProjects(): Promise<PromptProjectsStorage> {
    const db = getDb()
    const database = db.getDatabase()

    // Query prompt-project associations directly from columns
    const query = database.prepare(`
      SELECT id, prompt_id, project_id, created_at
      FROM prompt_projects
      ORDER BY created_at DESC
    `)

    const rows = query.all() as any[]

    // Convert rows to PromptProjectsStorage
    const promptProjects: PromptProject[] = []
    for (const row of rows) {
      const association: PromptProject = {
        id: row.id,
        promptId: row.prompt_id,
        projectId: row.project_id
      }

      // Validate the result
      const validationResult = PromptProjectSchema.safeParse(association)
      if (!validationResult.success) {
        console.error(`Skipping invalid prompt-project association ${row.id}:`, validationResult.error.errors)
        continue
      }

      promptProjects.push(validationResult.data)
    }

    return promptProjects
  },

  /** Writes all prompt-project associations to the database (replaces entire collection). */
  async writePromptProjects(promptProjects: PromptProjectsStorage): Promise<PromptProjectsStorage> {
    const db = getDb()
    const database = db.getDatabase()

    // Validate input
    const validatedAssociations = await validateData(
      promptProjects,
      PromptProjectsStorageSchema,
      'prompt-project associations'
    )

    // Use transaction to ensure atomicity
    database.transaction(() => {
      // Clear existing associations
      database.exec(`DELETE FROM prompt_projects`)

      // Insert all associations
      const insertStmt = database.prepare(`
        INSERT INTO prompt_projects (id, prompt_id, project_id, created_at)
        VALUES (?, ?, ?, ?)
      `)

      for (const association of validatedAssociations) {
        const now = Date.now()
        insertStmt.run(association.id, association.promptId, association.projectId, now)
      }
    })()

    return validatedAssociations
  },

  /** Gets a specific prompt by ID. */
  async getPromptById(promptId: number): Promise<Prompt | null> {
    const db = getDb()
    const database = db.getDatabase()

    const query = database.prepare(`
      SELECT id, name, content, project_id, created_at, updated_at
      FROM prompts
      WHERE id = ?
    `)

    const row = query.get(promptId) as any

    if (!row) {
      return null
    }

    const prompt: Prompt = {
      id: row.id,
      name: row.name,
      content: row.content,
      projectId: row.project_id,
      created: row.created_at,
      updated: row.updated_at
    }

    // Validate before returning
    return await validateData(prompt, PromptSchema, `prompt ${promptId}`)
  },

  /** Creates or updates a prompt. */
  async upsertPrompt(prompt: Prompt): Promise<Prompt> {
    const db = getDb()
    const database = db.getDatabase()

    // Validate the prompt
    const validatedPrompt = await validateData(prompt, PromptSchema, `prompt ${prompt.id}`)
    const now = Date.now()

    // Check if exists
    const existsQuery = database.prepare(`SELECT 1 FROM prompts WHERE id = ? LIMIT 1`)
    const existingRow = existsQuery.get(validatedPrompt.id)

    if (existingRow) {
      // Update
      const updateQuery = database.prepare(`
        UPDATE prompts
        SET name = ?, content = ?, project_id = ?, updated_at = ?
        WHERE id = ?
      `)
      updateQuery.run(
        validatedPrompt.name,
        validatedPrompt.content,
        validatedPrompt.projectId || null,
        now,
        validatedPrompt.id
      )
    } else {
      // Insert
      const insertQuery = database.prepare(`
        INSERT INTO prompts (id, name, content, project_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      insertQuery.run(
        validatedPrompt.id,
        validatedPrompt.name,
        validatedPrompt.content,
        validatedPrompt.projectId || null,
        validatedPrompt.created || now,
        now
      )
    }

    return validatedPrompt
  },

  /** Deletes a prompt and its associations. */
  async deletePrompt(promptId: number): Promise<boolean> {
    const db = getDb()
    const database = db.getDatabase()

    // Use transaction for deletion
    const result = database.transaction(() => {
      // Delete all associations for this prompt
      const deleteAssocQuery = database.prepare(`DELETE FROM prompt_projects WHERE prompt_id = ?`)
      deleteAssocQuery.run(promptId)

      // Delete the prompt
      const deletePromptQuery = database.prepare(`DELETE FROM prompts WHERE id = ?`)
      return deletePromptQuery.run(promptId).changes > 0
    })()

    return result
  },

  /** Gets all prompts associated with a project. */
  async getPromptsByProjectId(projectId: number): Promise<Prompt[]> {
    const db = getDb()
    const database = db.getDatabase()

    // Get prompts directly assigned to the project
    const directQuery = database.prepare(`
      SELECT id, name, content, project_id, created_at, updated_at
      FROM prompts
      WHERE project_id = ?
      ORDER BY created_at DESC
    `)

    // Get prompts through prompt_projects associations
    const associatedQuery = database.prepare(`
      SELECT p.id, p.name, p.content, p.project_id, p.created_at, p.updated_at
      FROM prompts p
      INNER JOIN prompt_projects pp ON p.id = pp.prompt_id
      WHERE pp.project_id = ?
      ORDER BY p.created_at DESC
    `)

    const directRows = directQuery.all(projectId) as any[]
    const associatedRows = associatedQuery.all(projectId) as any[]

    // Combine and deduplicate results
    const promptMap = new Map<number, Prompt>()

    for (const rows of [directRows, associatedRows]) {
      for (const row of rows) {
        if (!promptMap.has(row.id)) {
          const prompt: Prompt = {
            id: row.id,
            name: row.name,
            content: row.content,
            projectId: row.project_id,
            created: row.created_at,
            updated: row.updated_at
          }

          // Validate before adding
          try {
            const validatedPrompt = await validateData(prompt, PromptSchema, `prompt ${row.id}`)
            promptMap.set(row.id, validatedPrompt)
          } catch (error) {
            console.error(`Skipping invalid prompt ${row.id}:`, error)
          }
        }
      }
    }

    return Array.from(promptMap.values())
  },

  /** Adds or updates a prompt-project association. */
  async addPromptProjectAssociation(promptId: number, projectId: number): Promise<PromptProject> {
    const db = getDb()
    const database = db.getDatabase()

    // Check if association already exists
    const existsQuery = database.prepare(`
      SELECT id FROM prompt_projects 
      WHERE prompt_id = ? AND project_id = ?
      LIMIT 1
    `)
    const existingRow = existsQuery.get(promptId, projectId) as any

    if (existingRow) {
      // Already exists, return it
      return {
        id: existingRow.id,
        promptId,
        projectId
      }
    }

    // Create new association
    const association: PromptProject = {
      id: Date.now(),
      promptId,
      projectId
    }

    // Validate the association
    const validatedAssociation = await validateData(association, PromptProjectSchema, 'prompt-project association')

    // Insert
    const insertQuery = database.prepare(`
      INSERT INTO prompt_projects (id, prompt_id, project_id, created_at)
      VALUES (?, ?, ?, ?)
    `)
    insertQuery.run(validatedAssociation.id, validatedAssociation.promptId, validatedAssociation.projectId, Date.now())

    return validatedAssociation
  },

  /** Removes a prompt-project association. */
  async removePromptProjectAssociation(promptId: number, projectId: number): Promise<boolean> {
    const db = getDb()
    const database = db.getDatabase()

    const deleteQuery = database.prepare(`
      DELETE FROM prompt_projects 
      WHERE prompt_id = ? AND project_id = ?
    `)
    const result = deleteQuery.run(promptId, projectId)

    return result.changes > 0
  },

  /** Generates a unique ID. */
  generateId: (): number => {
    const db = getDb()
    return db.generateUniqueId('prompts')
  }
}
