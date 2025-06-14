import { z } from 'zod'
import path from 'node:path'
import { PromptSchema, PromptProjectSchema, type Prompt, type PromptProject } from '@octoprompt/schemas'
import { IndexedStorage, type IndexDefinition } from './core/indexed-storage'
import { type StorageOptions } from './core/base-storage'
import { searchByFields, getUniqueFieldValues, commonSorters } from './core/storage-query-utils'
import { AssociationManager } from './core/storage-patterns'
import { IndexBuilder } from './core/index-builder'
import { STORAGE_CONFIG } from './config'

// Storage schemas
export const PromptsStorageSchema = z.record(z.string(), PromptSchema)
export type PromptsStorage = z.infer<typeof PromptsStorageSchema>

export const PromptProjectsStorageSchema = z.array(PromptProjectSchema)
export type PromptProjectsStorage = z.infer<typeof PromptProjectsStorageSchema>

/**
 * Enhanced prompt storage with full-text search, categorization, and project associations
 */
export class PromptStorage extends IndexedStorage<Prompt, PromptsStorage> {
  private projectAssociations: AssociationManager<PromptProject>

  constructor(options: StorageOptions = {}) {
    const dataDir = path.join('data', 'prompt_storage')
    super(PromptsStorageSchema, PromptSchema, dataDir, options)
    
    // Define indexes using IndexBuilder
    this.indexDefinitions = new IndexBuilder()
      .setPrefix('prompts')
      .addTextIndex('name')
      .addTextIndex('content')
      .addSparseIndex('category', 'hash')
      .addTextIndex('tags')
      .addDateIndex('created')
      .addDateIndex('updated')
      .addHashIndex('isGlobal')
      .addHashIndex('visibility')
      .build()
    
    // Initialize project associations
    this.projectAssociations = new AssociationManager<PromptProject>(
      path.join(this.basePath, this.dataDir, 'prompt-projects.json'),
      PromptProjectSchema,
      { keyFields: ['promptId', 'projectId'], basePath: this.basePath }
    )
    
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



  // Override delete to handle associations
  public async delete(id: number): Promise<boolean> {
    const result = await super.delete(id)
    if (result) {
      // Remove project associations
      await this.projectAssociations.removeAll({ promptId: id })
    }
    return result
  }

  // --- Search and Query Methods ---

  /**
   * Full-text search across name and content
   */
  public async search(query: string): Promise<Prompt[]> {
    return searchByFields(
      this.indexManager,
      query,
      ['prompts_by_name', 'prompts_by_content'],
      (id) => this.getById(id),
      {
        preferredIndex: 'prompts_by_name',
        sorter: commonSorters.byUpdatedDesc
      }
    )
  }

  /**
   * Search by name only
   */
  public async searchByName(query: string): Promise<Prompt[]> {
    return this.searchByIndex('prompts_by_name', query, commonSorters.byUpdatedDesc)
  }

  /**
   * Search by content
   */
  public async searchByContent(query: string): Promise<Prompt[]> {
    return this.searchByIndex('prompts_by_content', query, commonSorters.byUpdatedDesc)
  }

  /**
   * Get prompts by category
   */
  public async getByCategory(category: string): Promise<Prompt[]> {
    return this.queryByIndex('prompts_by_category', category, commonSorters.byUpdatedDesc)
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
    return this.queryByIndex('prompts_by_isGlobal', true, commonSorters.byName)
  }

  /**
   * Get prompts by visibility
   */
  public async getByVisibility(visibility: 'public' | 'private' | 'shared'): Promise<Prompt[]> {
    return this.queryByIndex('prompts_by_visibility', visibility, commonSorters.byUpdatedDesc)
  }

  /**
   * Get recently created prompts
   */
  public async getRecentlyCreated(limit: number = 20): Promise<Prompt[]> {
    return this.getRecent(limit, 'created')
  }

  /**
   * Get recently updated prompts
   */
  public async getRecentlyUpdated(limit: number = 20): Promise<Prompt[]> {
    return this.getRecent(limit, 'updated')
  }

  /**
   * Get prompts within date range
   */
  public async getByDateRange(start: Date, end: Date): Promise<Prompt[]> {
    return this.queryByDateRange('prompts_by_created', start, end, commonSorters.byCreatedDesc)
  }

  /**
   * Get all unique categories
   */
  public async getCategories(): Promise<string[]> {
    const prompts = await this.list()
    const categories = getUniqueFieldValues(prompts, 'category')
    return Array.from(categories).filter((c): c is string => c !== null && c !== undefined).sort()
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
    return this.projectAssociations.create({ promptId, projectId })
  }

  /**
   * Remove prompt from project
   */
  public async removeFromProject(promptId: number, projectId: number): Promise<boolean> {
    return this.projectAssociations.remove({ promptId, projectId })
  }

  /**
   * Get prompts for a project
   */
  public async getProjectPrompts(projectId: number): Promise<Prompt[]> {
    const associations = await this.projectAssociations.find({ projectId })
    const prompts: Prompt[] = []
    
    for (const assoc of associations) {
      const prompt = await this.getById(assoc.promptId)
      if (prompt) prompts.push(prompt)
    }
    
    return prompts.sort(commonSorters.byName)
  }

  /**
   * Get projects using a prompt
   */
  public async getPromptProjects(promptId: number): Promise<number[]> {
    const associations = await this.projectAssociations.find({ promptId })
    return associations.map(assoc => assoc.projectId)
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


}


// Export singleton instance for backward compatibility
export const promptStorage = new PromptStorage({
  ...STORAGE_CONFIG,
  cacheTTL: 15 * 60 * 1000, // 15 minutes for prompts (they don't change often)
  maxCacheSize: 1000, // Cache up to 1000 prompts
  cacheStrategy: 'lru'
})