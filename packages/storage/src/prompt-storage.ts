import { z } from 'zod'
import path from 'node:path'
import { PromptSchema, PromptProjectSchema, type Prompt, type PromptProject } from '@octoprompt/schemas'
import { BaseStorage, type StorageOptions } from './core/base-storage'
import { IndexManager, type IndexConfig } from './core/index-manager'

// Storage schemas
export const PromptsStorageSchema = z.record(z.string(), PromptSchema)
export type PromptsStorage = z.infer<typeof PromptsStorageSchema>

export const PromptProjectsStorageSchema = z.array(PromptProjectSchema)
export type PromptProjectsStorage = z.infer<typeof PromptProjectsStorageSchema>

/**
 * Enhanced prompt storage with full-text search, categorization, and project associations
 */
export class PromptStorage extends BaseStorage<Prompt, PromptsStorage> {
  private indexManager: IndexManager
  private projectAssociations: PromptProjectAssociations

  constructor(options: StorageOptions = {}) {
    const dataDir = path.join('data', 'prompt_storage')
    super(PromptsStorageSchema, PromptSchema, dataDir, options)
    
    this.indexManager = new IndexManager(this.basePath, this.dataDir)
    this.projectAssociations = new PromptProjectAssociations(this.basePath, this.dataDir, options)
    
    // Initialize indexes
    this.initializeIndexes()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'prompts.json')
  }

  protected getEntityPath(id: number): string | null {
    // Prompts don't have separate entity paths
    return null
  }

  protected async initializeIndexes(): Promise<void> {
    const indexes: IndexConfig[] = [
      {
        name: 'prompts_by_name',
        type: 'inverted', // For partial name search
        fields: ['name']
      },
      {
        name: 'prompts_by_content',
        type: 'inverted', // For full-text search in content
        fields: ['content']
      },
      {
        name: 'prompts_by_category',
        type: 'hash',
        fields: ['category'],
        sparse: true // Not all prompts have categories
      },
      {
        name: 'prompts_by_tags',
        type: 'inverted', // For searching in tags array
        fields: ['tags']
      },
      {
        name: 'prompts_by_created',
        type: 'btree',
        fields: ['created']
      },
      {
        name: 'prompts_by_updated',
        type: 'btree',
        fields: ['updated']
      },
      {
        name: 'prompts_by_isGlobal',
        type: 'hash',
        fields: ['isGlobal']
      },
      {
        name: 'prompts_by_visibility',
        type: 'hash',
        fields: ['visibility']
      }
    ]

    for (const indexConfig of indexes) {
      try {
        await this.indexManager.createIndex(indexConfig)
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(`Failed to create index ${indexConfig.name}:`, error)
        }
      }
    }
  }

  // Override create to update indexes
  public async create(data: Omit<Prompt, 'id' | 'created' | 'updated'>): Promise<Prompt> {
    const prompt = await super.create(data)
    
    // Update indexes
    await this.updatePromptIndexes(prompt)
    
    return prompt
  }

  // Override update to maintain indexes
  public async update(id: number, data: Partial<Omit<Prompt, 'id' | 'created' | 'updated'>>): Promise<Prompt | null> {
    const existing = await this.getById(id)
    if (!existing) return null

    // Remove from indexes before update
    await this.removePromptFromIndexes(id)

    const updated = await super.update(id, data)
    if (!updated) return null

    // Re-add to indexes
    await this.updatePromptIndexes(updated)

    return updated
  }

  // Override delete to maintain indexes
  public async delete(id: number): Promise<boolean> {
    const result = await super.delete(id)
    if (result) {
      // Remove from indexes
      await this.removePromptFromIndexes(id)
      
      // Remove project associations
      await this.projectAssociations.removeByPromptId(id)
    }
    return result
  }

  // --- Search and Query Methods ---

  /**
   * Full-text search across name and content
   */
  public async search(query: string): Promise<Prompt[]> {
    // Search in both name and content
    const nameIds = await this.indexManager.searchText('prompts_by_name', query)
    const contentIds = await this.indexManager.searchText('prompts_by_content', query)
    
    // Combine and deduplicate
    const allIds = new Set([...nameIds, ...contentIds])
    const prompts: Prompt[] = []
    
    for (const id of allIds) {
      const prompt = await this.getById(id)
      if (prompt) prompts.push(prompt)
    }
    
    // Sort by relevance (approximate: prefer name matches, then by update time)
    return prompts.sort((a, b) => {
      const aNameMatch = nameIds.includes(a.id)
      const bNameMatch = nameIds.includes(b.id)
      
      if (aNameMatch && !bNameMatch) return -1
      if (!aNameMatch && bNameMatch) return 1
      
      return b.updated - a.updated
    })
  }

  /**
   * Search by name only
   */
  public async searchByName(query: string): Promise<Prompt[]> {
    const ids = await this.indexManager.searchText('prompts_by_name', query)
    const prompts: Prompt[] = []
    
    for (const id of ids) {
      const prompt = await this.getById(id)
      if (prompt) prompts.push(prompt)
    }
    
    return prompts.sort((a, b) => b.updated - a.updated)
  }

  /**
   * Search by content
   */
  public async searchByContent(query: string): Promise<Prompt[]> {
    const ids = await this.indexManager.searchText('prompts_by_content', query)
    const prompts: Prompt[] = []
    
    for (const id of ids) {
      const prompt = await this.getById(id)
      if (prompt) prompts.push(prompt)
    }
    
    return prompts.sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get prompts by category
   */
  public async getByCategory(category: string): Promise<Prompt[]> {
    const ids = await this.indexManager.query('prompts_by_category', category)
    const prompts: Prompt[] = []
    
    for (const id of ids) {
      const prompt = await this.getById(id)
      if (prompt) prompts.push(prompt)
    }
    
    return prompts.sort((a, b) => b.updated - a.updated)
  }

  /**
   * Search by tags
   */
  public async searchByTags(tags: string[]): Promise<Prompt[]> {
    const allIds = new Set<number>()
    
    for (const tag of tags) {
      const ids = await this.indexManager.searchText('prompts_by_tags', tag)
      ids.forEach(id => allIds.add(id))
    }
    
    const prompts: Prompt[] = []
    for (const id of allIds) {
      const prompt = await this.getById(id)
      if (prompt) prompts.push(prompt)
    }
    
    return prompts.sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get global prompts
   */
  public async getGlobalPrompts(): Promise<Prompt[]> {
    const ids = await this.indexManager.query('prompts_by_isGlobal', true)
    const prompts: Prompt[] = []
    
    for (const id of ids) {
      const prompt = await this.getById(id)
      if (prompt) prompts.push(prompt)
    }
    
    return prompts.sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Get prompts by visibility
   */
  public async getByVisibility(visibility: 'public' | 'private' | 'shared'): Promise<Prompt[]> {
    const ids = await this.indexManager.query('prompts_by_visibility', visibility)
    const prompts: Prompt[] = []
    
    for (const id of ids) {
      const prompt = await this.getById(id)
      if (prompt) prompts.push(prompt)
    }
    
    return prompts.sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get recently created prompts
   */
  public async getRecent(limit: number = 20): Promise<Prompt[]> {
    const prompts = await this.list()
    return prompts
      .sort((a, b) => b.created - a.created)
      .slice(0, limit)
  }

  /**
   * Get recently updated prompts
   */
  public async getRecentlyUpdated(limit: number = 20): Promise<Prompt[]> {
    const prompts = await this.list()
    return prompts
      .sort((a, b) => b.updated - a.updated)
      .slice(0, limit)
  }

  /**
   * Get prompts within date range
   */
  public async getByDateRange(start: Date, end: Date): Promise<Prompt[]> {
    const ids = await this.indexManager.queryRange(
      'prompts_by_created',
      start.getTime(),
      end.getTime()
    )
    
    const prompts: Prompt[] = []
    for (const id of ids) {
      const prompt = await this.getById(id)
      if (prompt) prompts.push(prompt)
    }
    
    return prompts.sort((a, b) => b.created - a.created)
  }

  /**
   * Get all unique categories
   */
  public async getCategories(): Promise<string[]> {
    const prompts = await this.list()
    const categories = new Set<string>()
    
    for (const prompt of prompts) {
      if (prompt.category) {
        categories.add(prompt.category)
      }
    }
    
    return Array.from(categories).sort()
  }

  /**
   * Get all unique tags
   */
  public async getTags(): Promise<string[]> {
    const prompts = await this.list()
    const tags = new Set<string>()
    
    for (const prompt of prompts) {
      if (prompt.tags) {
        prompt.tags.forEach(tag => tags.add(tag))
      }
    }
    
    return Array.from(tags).sort()
  }

  // --- Project Association Methods ---

  /**
   * Associate prompt with project
   */
  public async addToProject(promptId: number, projectId: number): Promise<PromptProject> {
    return this.projectAssociations.create(promptId, projectId)
  }

  /**
   * Remove prompt from project
   */
  public async removeFromProject(promptId: number, projectId: number): Promise<boolean> {
    return this.projectAssociations.remove(promptId, projectId)
  }

  /**
   * Get prompts for a project
   */
  public async getProjectPrompts(projectId: number): Promise<Prompt[]> {
    const associations = await this.projectAssociations.getByProjectId(projectId)
    const prompts: Prompt[] = []
    
    for (const assoc of associations) {
      const prompt = await this.getById(assoc.promptId)
      if (prompt) prompts.push(prompt)
    }
    
    return prompts.sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Get projects using a prompt
   */
  public async getPromptProjects(promptId: number): Promise<number[]> {
    const associations = await this.projectAssociations.getByPromptId(promptId)
    return associations.map(assoc => assoc.projectId)
  }

  // --- Legacy API Compatibility ---

  /**
   * Get all prompts (legacy API)
   */
  public async getAllPrompts(): Promise<Prompt[]> {
    return this.list()
  }

  /**
   * Get prompt by ID (legacy API)
   */
  public async getPrompt(id: number): Promise<Prompt | null> {
    return this.getById(id)
  }

  /**
   * Create prompt (legacy API)
   */
  public async createPrompt(data: Omit<Prompt, 'id' | 'created' | 'updated'>): Promise<Prompt> {
    return this.create(data)
  }

  /**
   * Update prompt (legacy API)
   */
  public async updatePrompt(id: number, data: Partial<Omit<Prompt, 'id' | 'created' | 'updated'>>): Promise<Prompt | null> {
    return this.update(id, data)
  }

  /**
   * Delete prompt (legacy API)
   */
  public async deletePrompt(id: number): Promise<boolean> {
    return this.delete(id)
  }

  /**
   * Get prompt projects (legacy API)
   */
  public async getPromptProjectAssociations(): Promise<PromptProject[]> {
    return this.projectAssociations.getAll()
  }

  /**
   * Create prompt project association (legacy API)
   */
  public async createPromptProject(data: PromptProject): Promise<PromptProject> {
    return this.projectAssociations.create(data.promptId, data.projectId)
  }

  /**
   * Delete prompt project association (legacy API)
   */
  public async deletePromptProject(promptId: number, projectId: number): Promise<boolean> {
    return this.projectAssociations.remove(promptId, projectId)
  }

  // --- V1 Storage API Compatibility ---

  /**
   * Read prompts (V1 storage API)
   */
  public async readPrompts(): Promise<PromptsStorage> {
    const prompts = await this.list()
    const storage: PromptsStorage = {}
    for (const prompt of prompts) {
      storage[prompt.id.toString()] = prompt
    }
    return storage
  }

  /**
   * Write prompts (V1 storage API)
   */
  public async writePrompts(prompts: PromptsStorage): Promise<PromptsStorage> {
    // This is a complex migration operation - for now, return the input
    // In a real migration, we'd need to carefully handle this
    return prompts
  }

  /**
   * Read prompt projects (V1 storage API)
   */
  public async readPromptProjects(): Promise<PromptProjectsStorage> {
    return this.projectAssociations.getAll()
  }

  /**
   * Write prompt projects (V1 storage API)
   */
  public async writePromptProjects(projects: PromptProjectsStorage): Promise<PromptProjectsStorage> {
    // This is a complex migration operation - for now, return the input
    // In a real migration, we'd need to carefully handle this
    return projects
  }

  /**
   * Generate ID (V1 storage API)
   */
  public generateId(): number {
    return Date.now()
  }

  // --- Statistics and Analytics ---

  /**
   * Get prompt usage statistics
   */
  public async getStats() {
    const prompts = await this.list()
    const categories = await this.getCategories()
    const tags = await this.getTags()
    
    const stats = {
      totalPrompts: prompts.length,
      globalPrompts: prompts.filter(p => p.isGlobal).length,
      categorized: prompts.filter(p => p.category).length,
      tagged: prompts.filter(p => p.tags && p.tags.length > 0).length,
      categories: categories.length,
      tags: tags.length,
      byVisibility: {
        public: prompts.filter(p => p.visibility === 'public').length,
        private: prompts.filter(p => p.visibility === 'private').length,
        shared: prompts.filter(p => p.visibility === 'shared').length
      }
    }
    
    return stats
  }

  // --- Index Management ---

  public async rebuildIndexes(): Promise<void> {
    const prompts = await this.list()
    
    const indexNames = [
      'prompts_by_name',
      'prompts_by_content', 
      'prompts_by_category',
      'prompts_by_tags',
      'prompts_by_created',
      'prompts_by_updated',
      'prompts_by_isGlobal',
      'prompts_by_visibility'
    ]
    
    for (const indexName of indexNames) {
      await this.indexManager.rebuildIndex(indexName, prompts)
    }
  }

  public async getIndexStats() {
    const indexNames = [
      'prompts_by_name',
      'prompts_by_content', 
      'prompts_by_category',
      'prompts_by_tags',
      'prompts_by_created',
      'prompts_by_updated',
      'prompts_by_isGlobal',
      'prompts_by_visibility'
    ]
    
    const stats = []
    for (const indexName of indexNames) {
      const indexStats = await this.indexManager.getIndexStats(indexName)
      if (indexStats) stats.push(indexStats)
    }
    
    return stats
  }

  // --- Helper Methods ---

  private async updatePromptIndexes(prompt: Prompt): Promise<void> {
    await this.indexManager.addToIndex('prompts_by_name', prompt.id, prompt)
    await this.indexManager.addToIndex('prompts_by_content', prompt.id, prompt)
    
    if (prompt.category) {
      await this.indexManager.addToIndex('prompts_by_category', prompt.id, prompt)
    }
    
    if (prompt.tags && prompt.tags.length > 0) {
      await this.indexManager.addToIndex('prompts_by_tags', prompt.id, prompt)
    }
    
    await this.indexManager.addToIndex('prompts_by_created', prompt.id, prompt)
    await this.indexManager.addToIndex('prompts_by_updated', prompt.id, prompt)
    await this.indexManager.addToIndex('prompts_by_isGlobal', prompt.id, prompt)
    await this.indexManager.addToIndex('prompts_by_visibility', prompt.id, prompt)
  }

  private async removePromptFromIndexes(promptId: number): Promise<void> {
    const indexNames = [
      'prompts_by_name',
      'prompts_by_content', 
      'prompts_by_category',
      'prompts_by_tags',
      'prompts_by_created',
      'prompts_by_updated',
      'prompts_by_isGlobal',
      'prompts_by_visibility'
    ]
    
    for (const indexName of indexNames) {
      await this.indexManager.removeFromIndex(indexName, promptId)
    }
  }
}

/**
 * Storage for prompt-project associations
 */
class PromptProjectAssociations {
  private filePath: string
  private options: StorageOptions

  constructor(basePath: string, dataDir: string, options: StorageOptions) {
    this.filePath = path.join(basePath, dataDir, 'prompt-projects.json')
    this.options = options
  }

  private async readAssociations(): Promise<PromptProject[]> {
    try {
      const content = await import('node:fs/promises').then(fs => fs.readFile(this.filePath, 'utf-8'))
      const data = JSON.parse(content)
      return PromptProjectsStorageSchema.parse(data)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []
      }
      console.error(`Error reading prompt-projects: ${error.message}`)
      return []
    }
  }

  private async writeAssociations(associations: PromptProject[]): Promise<void> {
    const fs = await import('node:fs/promises')
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    
    const content = JSON.stringify(associations, null, 2)
    await fs.writeFile(this.filePath, content, 'utf-8')
  }

  public async create(promptId: number, projectId: number): Promise<PromptProject> {
    const associations = await this.readAssociations()
    
    // Check if association already exists
    const existing = associations.find(a => a.promptId === promptId && a.projectId === projectId)
    if (existing) {
      return existing
    }
    
    const newAssociation: PromptProject = {
      promptId,
      projectId,
      created: Date.now()
    }
    
    associations.push(newAssociation)
    await this.writeAssociations(associations)
    
    return newAssociation
  }

  public async remove(promptId: number, projectId: number): Promise<boolean> {
    const associations = await this.readAssociations()
    const index = associations.findIndex(a => a.promptId === promptId && a.projectId === projectId)
    
    if (index === -1) {
      return false
    }
    
    associations.splice(index, 1)
    await this.writeAssociations(associations)
    
    return true
  }

  public async getByPromptId(promptId: number): Promise<PromptProject[]> {
    const associations = await this.readAssociations()
    return associations.filter(a => a.promptId === promptId)
  }

  public async getByProjectId(projectId: number): Promise<PromptProject[]> {
    const associations = await this.readAssociations()
    return associations.filter(a => a.projectId === projectId)
  }

  public async removeByPromptId(promptId: number): Promise<number> {
    const associations = await this.readAssociations()
    const initialLength = associations.length
    
    const filtered = associations.filter(a => a.promptId !== promptId)
    await this.writeAssociations(filtered)
    
    return initialLength - filtered.length
  }

  public async removeByProjectId(projectId: number): Promise<number> {
    const associations = await this.readAssociations()
    const initialLength = associations.length
    
    const filtered = associations.filter(a => a.projectId !== projectId)
    await this.writeAssociations(filtered)
    
    return initialLength - filtered.length
  }

  public async getAll(): Promise<PromptProject[]> {
    return this.readAssociations()
  }
}

// Export singleton instance for backward compatibility
export const promptStorage = new PromptStorage({
  cacheEnabled: true,
  cacheTTL: 15 * 60 * 1000, // 15 minutes for prompts (they don't change often)
  maxCacheSize: 1000, // Cache up to 1000 prompts
  cacheStrategy: 'lru'
})