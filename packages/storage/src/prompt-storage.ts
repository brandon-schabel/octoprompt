import { z } from 'zod'
import path from 'node:path'
import { PromptSchema, PromptProjectSchema, type Prompt, type PromptProject } from '@octoprompt/schemas'
import { BaseStorage, type StorageOptions } from './core/base-storage'
import { AssociationManager } from './core/storage-patterns'
import { STORAGE_CONFIG } from './config'

// Storage schemas
export const PromptsStorageSchema = z.record(z.string(), PromptSchema)
export type PromptsStorage = z.infer<typeof PromptsStorageSchema>

export const PromptProjectsStorageSchema = z.array(PromptProjectSchema)
export type PromptProjectsStorage = z.infer<typeof PromptProjectsStorageSchema>

/**
 * Enhanced prompt storage with full-text search, categorization, and project associations
 */
export class PromptStorage extends BaseStorage<Prompt, PromptsStorage> {
  private projectAssociations: AssociationManager<PromptProject>

  constructor(options: StorageOptions = {}) {
    const dataDir = path.join('data', 'prompt_storage')
    super(PromptsStorageSchema, PromptSchema, dataDir, options)

    // Initialize project associations
    this.projectAssociations = new AssociationManager<PromptProject>(
      path.join(this.basePath, this.dataDir, 'prompt-projects.json'),
      PromptProjectSchema,
      { keyFields: ['promptId', 'projectId'], basePath: this.basePath }
    )
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
    const all = await this.list()
    const lowercaseQuery = query.toLowerCase()
    return all
      .filter(prompt => 
        prompt.name.toLowerCase().includes(lowercaseQuery) ||
        prompt.content.toLowerCase().includes(lowercaseQuery)
      )
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Search by name only
   */
  public async searchByName(query: string): Promise<Prompt[]> {
    const all = await this.list()
    const lowercaseQuery = query.toLowerCase()
    return all
      .filter(prompt => prompt.name.toLowerCase().includes(lowercaseQuery))
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Search by content
   */
  public async searchByContent(query: string): Promise<Prompt[]> {
    const all = await this.list()
    const lowercaseQuery = query.toLowerCase()
    return all
      .filter(prompt => prompt.content.toLowerCase().includes(lowercaseQuery))
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get prompts by category
   */
  public async getByCategory(category: string): Promise<Prompt[]> {
    const all = await this.list()
    return all
      .filter(prompt => prompt.category === category)
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Search by tags
   */
  public async searchByTags(tags: string[]): Promise<Prompt[]> {
    const all = await this.list()
    const lowerTags = tags.map(t => t.toLowerCase())
    return all
      .filter(prompt => {
        if (!prompt.tags) return false
        const promptTagsLower = prompt.tags.map(t => t.toLowerCase())
        return lowerTags.some(tag => promptTagsLower.includes(tag))
      })
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get global prompts
   */
  public async getGlobalPrompts(): Promise<Prompt[]> {
    const all = await this.list()
    return all
      .filter(prompt => prompt.isGlobal === true)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Get prompts by visibility
   */
  public async getByVisibility(visibility: 'public' | 'private' | 'shared'): Promise<Prompt[]> {
    const all = await this.list()
    return all
      .filter(prompt => prompt.visibility === visibility)
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get recently created prompts
   */
  public async getRecentlyCreated(limit: number = 20): Promise<Prompt[]> {
    const all = await this.list()
    return all
      .sort((a, b) => b.created - a.created)
      .slice(0, limit)
  }

  /**
   * Get recently updated prompts
   */
  public async getRecentlyUpdated(limit: number = 20): Promise<Prompt[]> {
    const all = await this.list()
    return all
      .sort((a, b) => b.updated - a.updated)
      .slice(0, limit)
  }

  /**
   * Get prompts within date range
   */
  public async getByDateRange(start: Date, end: Date): Promise<Prompt[]> {
    const all = await this.list()
    const startMs = start.getTime()
    const endMs = end.getTime()
    return all
      .filter(prompt => prompt.created >= startMs && prompt.created <= endMs)
      .sort((a, b) => b.created - a.created)
  }

  /**
   * Get all unique categories
   */
  public async getCategories(): Promise<string[]> {
    const prompts = await this.list()
    const categories = new Set<string | null>()
    prompts.forEach(p => categories.add(p.category))
    return Array.from(categories)
      .filter((c): c is string => c !== null && c !== undefined)
      .sort()
  }

  /**
   * Get all unique tags
   */
  public async getTags(): Promise<string[]> {
    const prompts = await this.list()
    const tags = new Set<string>()

    for (const prompt of prompts) {
      if (prompt.tags) {
        prompt.tags.forEach((tag) => tags.add(tag))
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
    return associations.map((assoc) => assoc.projectId)
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
      globalPrompts: prompts.filter((p) => p.isGlobal).length,
      categorized: prompts.filter((p) => p.category).length,
      tagged: prompts.filter((p) => p.tags && p.tags.length > 0).length,
      categories: categories.length,
      tags: tags.length,
      byVisibility: {
        public: prompts.filter((p) => p.visibility === 'public').length,
        private: prompts.filter((p) => p.visibility === 'private').length,
        shared: prompts.filter((p) => p.visibility === 'shared').length
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
