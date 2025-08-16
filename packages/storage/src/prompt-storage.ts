import { z } from 'zod'
import { PromptSchema, PromptProjectSchema, type Prompt, type PromptProject } from '@promptliano/schemas'
import { BaseStorage } from './base-storage'
import { 
  createEntityConverter,
  createStandardMappings,
  getInsertColumnsFromMappings,
  getInsertValuesFromEntity,
  FieldMapping
} from './utils/storage-helpers'
import { ApiError } from '@promptliano/shared'
import { SqliteConverters } from '@promptliano/shared/src/utils/sqlite-converters'

// --- Schemas for Storage ---
export const PromptsStorageSchema = z.record(z.string(), PromptSchema)
export type PromptsStorage = z.infer<typeof PromptsStorageSchema>

export const PromptProjectsStorageSchema = z.array(PromptProjectSchema)
export type PromptProjectsStorage = z.infer<typeof PromptProjectsStorageSchema>

/**
 * Prompt storage implementation using BaseStorage
 */
class PromptStorage extends BaseStorage<Prompt, PromptsStorage> {
  protected readonly tableName = 'prompts'
  protected readonly entitySchema = PromptSchema as any
  protected readonly storageSchema = PromptsStorageSchema as any

  private readonly fieldMappings = {
    id: { dbColumn: 'id', converter: (v: any) => SqliteConverters.toNumber(v) },
    name: { dbColumn: 'name', converter: (v: any) => SqliteConverters.toString(v) },
    content: { dbColumn: 'content', converter: (v: any) => SqliteConverters.toString(v) },
    projectId: { dbColumn: 'project_id', converter: (v: any) => v === null || v === undefined ? undefined : SqliteConverters.toNumber(v) },
    created: { dbColumn: 'created_at', converter: (v: any) => SqliteConverters.toTimestamp(v) },
    updated: { dbColumn: 'updated_at', converter: (v: any) => SqliteConverters.toTimestamp(v) }
  } as Record<keyof Prompt, FieldMapping>

  private readonly converter = createEntityConverter(
    this.entitySchema,
    this.fieldMappings
  )

  protected rowToEntity(row: any): Prompt {
    return this.converter(row)
  }

  protected getSelectColumns(): string[] {
    return ['id', 'name', 'content', 'project_id', 'created_at', 'updated_at']
  }

  protected getInsertColumns(): string[] {
    return getInsertColumnsFromMappings(this.fieldMappings)
  }

  protected getInsertValues(entity: Prompt): any[] {
    return getInsertValuesFromEntity(entity, this.fieldMappings)
  }

  // Convenience methods maintaining backward compatibility
  async readPrompts(): Promise<PromptsStorage> {
    return this.readAll()
  }

  async writePrompts(prompts: PromptsStorage): Promise<PromptsStorage> {
    return this.writeAll(prompts)
  }

  async readPromptsByProject(projectId: number): Promise<PromptsStorage> {
    return this.readAll('project_id = ?', [projectId])
  }

  async countPromptsByProject(projectId: number): Promise<number> {
    return this.count('project_id = ?', [projectId])
  }

  async readPromptProjectAssociations(): Promise<PromptProjectsStorage> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT id, prompt_id, project_id
        FROM prompt_projects
        ORDER BY prompt_id, project_id
      `)

      const rows = query.all() as any[]
      const associations: PromptProjectsStorage = []

      for (const row of rows) {
        const association: PromptProject = {
          id: row.id,
          promptId: row.prompt_id,
          projectId: row.project_id
        }

        // Validate each association
        const validated = await this.validateData(association, PromptProjectSchema, 'prompt-project association')
        associations.push(validated)
      }

      return associations
    } catch (error: any) {
      console.error('Error reading prompt-project associations:', error)
      throw new ApiError(500, 'Failed to read prompt-project associations', 'DB_READ_ERROR', error)
    }
  }

  async writePromptProjectAssociations(associations: PromptProjectsStorage): Promise<PromptProjectsStorage> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      // Validate input
      const validated = await this.validateData(associations, PromptProjectsStorageSchema, 'prompt-project associations')

      // Use transaction to ensure atomicity
      database.transaction(() => {
        // Clear existing associations
        database.exec(`DELETE FROM prompt_projects`)

        // Insert new associations
        const insertStmt = database.prepare(`
          INSERT INTO prompt_projects (prompt_id, project_id)
          VALUES (?, ?)
        `)

        for (const association of validated) {
          insertStmt.run(association.promptId, association.projectId)
        }
      })()

      return validated
    } catch (error: any) {
      console.error('Error writing prompt-project associations:', error)
      throw new ApiError(500, 'Failed to write prompt-project associations', 'DB_WRITE_ERROR', error)
    }
  }

  async addPrompt(prompt: Prompt): Promise<Prompt> {
    return this.add(prompt)
  }

  async replacePrompt(promptId: number, prompt: Prompt): Promise<boolean> {
    try {
      await this.update(promptId, prompt)
      return true
    } catch (error: any) {
      if (error.code === 'NOT_FOUND') {
        return false
      }
      throw error
    }
  }

  async removePrompt(promptId: number): Promise<void> {
    await this.delete(promptId)
  }

  async addPromptToProject(promptId: number, projectId: number): Promise<void> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const insertStmt = database.prepare(`
        INSERT OR IGNORE INTO prompt_projects (prompt_id, project_id)
        VALUES (?, ?)
      `)

      insertStmt.run(promptId, projectId)
    } catch (error: any) {
      console.error(`Error adding prompt ${promptId} to project ${projectId}:`, error)
      throw new ApiError(500, 'Failed to add prompt to project', 'DB_WRITE_ERROR', error)
    }
  }

  async removePromptFromProject(promptId: number, projectId: number): Promise<void> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const deleteStmt = database.prepare(`
        DELETE FROM prompt_projects
        WHERE prompt_id = ? AND project_id = ?
      `)

      deleteStmt.run(promptId, projectId)
    } catch (error: any) {
      console.error(`Error removing prompt ${promptId} from project ${projectId}:`, error)
      throw new ApiError(500, 'Failed to remove prompt from project', 'DB_DELETE_ERROR', error)
    }
  }

  async isPromptInProject(promptId: number, projectId: number): Promise<boolean> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT COUNT(*) as count
        FROM prompt_projects
        WHERE prompt_id = ? AND project_id = ?
      `)

      const result = query.get(promptId, projectId) as any
      return result.count > 0
    } catch (error: any) {
      console.error(`Error checking if prompt ${promptId} is in project ${projectId}:`, error)
      throw new ApiError(500, 'Failed to check prompt-project association', 'DB_READ_ERROR', error)
    }
  }
}

// Create singleton instance
const promptStorageInstance = new PromptStorage()

// Export the storage object for backward compatibility
export const promptStorage = {
  readPrompts: () => promptStorageInstance.readPrompts(),
  writePrompts: (prompts: PromptsStorage) => promptStorageInstance.writePrompts(prompts),
  readPromptsByProject: (projectId: number) => promptStorageInstance.readPromptsByProject(projectId),
  countPromptsByProject: (projectId: number) => promptStorageInstance.countPromptsByProject(projectId),
  readPromptProjectAssociations: () => promptStorageInstance.readPromptProjectAssociations(),
  writePromptProjectAssociations: (associations: PromptProjectsStorage) => 
    promptStorageInstance.writePromptProjectAssociations(associations),
  addPrompt: (prompt: Prompt) => promptStorageInstance.addPrompt(prompt),
  replacePrompt: (promptId: number, prompt: Prompt) => promptStorageInstance.replacePrompt(promptId, prompt),
  removePrompt: (promptId: number) => promptStorageInstance.removePrompt(promptId),
  addPromptToProject: (promptId: number, projectId: number) => 
    promptStorageInstance.addPromptToProject(promptId, projectId),
  removePromptFromProject: (promptId: number, projectId: number) => 
    promptStorageInstance.removePromptFromProject(promptId, projectId),
  isPromptInProject: (promptId: number, projectId: number) => 
    promptStorageInstance.isPromptInProject(promptId, projectId),
  generateId: () => promptStorageInstance.generateId()
}