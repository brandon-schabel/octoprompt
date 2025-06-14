import { z, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises'
import type { BaseEntity } from './base-storage'

/**
 * Interface for versioned entities
 */
export interface VersionedEntity extends BaseEntity {
  version: number
  prevId: number | null
  nextId: number | null
  isLatest: boolean
  originalId: number | null
}

/**
 * Interface for soft-deletable entities
 */
export interface SoftDeletableEntity extends BaseEntity {
  deletedAt: number | null
  deletedBy?: string | null
}

/**
 * Interface for auditable entities
 */
export interface AuditableEntity extends BaseEntity {
  createdBy?: string
  updatedBy?: string
  lastAction?: string
}

/**
 * Mixin for version management
 */
export class VersioningMixin<T extends VersionedEntity> {
  constructor(
    private getById: (id: number) => Promise<T | null>,
    private create: (data: any) => Promise<T>,
    private update: (id: number, data: any) => Promise<T | null>
  ) {}

  /**
   * Create a new version of an entity
   */
  async createVersion(
    currentId: number,
    changes: Partial<Omit<T, keyof VersionedEntity>>,
    metadata?: { reason?: string; author?: string }
  ): Promise<T> {
    const current = await this.getById(currentId)
    if (!current) {
      throw new Error(`Entity ${currentId} not found for versioning`)
    }

    // Mark current as not latest
    await this.update(currentId, { isLatest: false })

    // Create new version
    const newVersion = await this.create({
      ...current,
      ...changes,
      version: current.version + 1,
      prevId: currentId,
      isLatest: true,
      originalId: current.originalId || current.id,
      versionMetadata: metadata
    })

    // Update current to point to new version
    await this.update(currentId, { nextId: newVersion.id })

    return newVersion
  }

  /**
   * Get version history for an entity
   */
  async getVersionHistory(entityId: number): Promise<T[]> {
    const entity = await this.getById(entityId)
    if (!entity) return []

    const originalId = entity.originalId || entity.id
    const versions: T[] = []
    
    // Walk the version chain
    let currentId: number | null = originalId
    while (currentId !== null) {
      const version = await this.getById(currentId)
      if (version) {
        versions.push(version)
        currentId = version.nextId
      } else {
        break
      }
    }

    return versions
  }

  /**
   * Restore a previous version
   */
  async restoreVersion(versionId: number): Promise<T> {
    const version = await this.getById(versionId)
    if (!version) {
      throw new Error(`Version ${versionId} not found`)
    }

    // Find current latest
    const history = await this.getVersionHistory(version.originalId || version.id)
    const latest = history.find(v => v.isLatest)
    
    if (!latest) {
      throw new Error('No latest version found')
    }

    // Create new version with content from the restored version
    const { id, created, updated, version: _, prevId, nextId, isLatest, ...content } = version
    
    return this.createVersion(latest.id, content, {
      reason: `Restored from version ${version.version}`,
      author: 'system'
    })
  }
}

/**
 * Mixin for soft delete functionality
 */
export class SoftDeleteMixin<T extends SoftDeletableEntity> {
  constructor(
    private update: (id: number, data: any) => Promise<T | null>,
    private list: () => Promise<T[]>
  ) {}

  /**
   * Soft delete an entity
   */
  async softDelete(id: number, deletedBy?: string): Promise<boolean> {
    const result = await this.update(id, {
      deletedAt: Date.now(),
      deletedBy
    })
    return result !== null
  }

  /**
   * Restore a soft-deleted entity
   */
  async restore(id: number): Promise<T | null> {
    return this.update(id, {
      deletedAt: null,
      deletedBy: null
    })
  }

  /**
   * Get only active (non-deleted) entities
   */
  async listActive(): Promise<T[]> {
    const all = await this.list()
    return all.filter(entity => entity.deletedAt === null)
  }

  /**
   * Get only deleted entities
   */
  async listDeleted(): Promise<T[]> {
    const all = await this.list()
    return all.filter(entity => entity.deletedAt !== null)
  }

  /**
   * Permanently delete soft-deleted entities older than specified days
   */
  async cleanupDeleted(daysOld: number = 30): Promise<number> {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000)
    const deleted = await this.listDeleted()
    
    let count = 0
    for (const entity of deleted) {
      if (entity.deletedAt && entity.deletedAt < cutoffTime) {
        // Would need actual delete method here
        count++
      }
    }
    
    return count
  }
}

/**
 * Association management for many-to-many relationships
 */
export class AssociationManager<TAssociation extends { id?: number; created: number }> {
  constructor(
    private filePath: string,
    private schema: ZodTypeAny,
    private options: {
      keyFields: string[]
      basePath?: string
    }
  ) {}

  private async readAssociations(): Promise<TAssociation[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8')
      const data = JSON.parse(content)
      return this.schema.array().parse(data)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []
      }
      console.error(`Error reading associations: ${error.message}`)
      return []
    }
  }

  private async writeAssociations(associations: TAssociation[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    const content = JSON.stringify(associations, null, 2)
    await fs.writeFile(this.filePath, content, 'utf-8')
  }

  /**
   * Create an association
   */
  async create(data: Omit<TAssociation, 'id' | 'created'>): Promise<TAssociation> {
    const associations = await this.readAssociations()
    
    // Check if association already exists
    const existing = associations.find(a => 
      this.options.keyFields.every(field => 
        (a as any)[field] === (data as any)[field]
      )
    )
    
    if (existing) {
      return existing
    }
    
    const newAssociation: TAssociation = {
      ...data,
      created: Date.now()
    } as TAssociation
    
    associations.push(newAssociation)
    await this.writeAssociations(associations)
    
    return newAssociation
  }

  /**
   * Remove an association
   */
  async remove(criteria: Partial<TAssociation>): Promise<boolean> {
    const associations = await this.readAssociations()
    const index = associations.findIndex(a =>
      Object.entries(criteria).every(([key, value]) =>
        (a as any)[key] === value
      )
    )
    
    if (index === -1) {
      return false
    }
    
    associations.splice(index, 1)
    await this.writeAssociations(associations)
    
    return true
  }

  /**
   * Find associations by criteria
   */
  async find(criteria: Partial<TAssociation>): Promise<TAssociation[]> {
    const associations = await this.readAssociations()
    return associations.filter(a =>
      Object.entries(criteria).every(([key, value]) =>
        (a as any)[key] === value
      )
    )
  }

  /**
   * Remove all associations matching criteria
   */
  async removeAll(criteria: Partial<TAssociation>): Promise<number> {
    const associations = await this.readAssociations()
    const initialLength = associations.length
    
    const filtered = associations.filter(a =>
      !Object.entries(criteria).every(([key, value]) =>
        (a as any)[key] === value
      )
    )
    
    await this.writeAssociations(filtered)
    
    return initialLength - filtered.length
  }

  /**
   * Get all associations
   */
  async getAll(): Promise<TAssociation[]> {
    return this.readAssociations()
  }
}

/**
 * Audit log manager
 */
export class AuditLogger {
  constructor(
    private logPath: string,
    private entityType: string
  ) {}

  async log(event: {
    entityId: number | string
    action: string
    userId?: string
    details?: any
    timestamp?: number
  }): Promise<void> {
    const logEntry = {
      timestamp: event.timestamp || Date.now(),
      entityType: this.entityType,
      entityId: event.entityId,
      action: event.action,
      userId: event.userId || 'system',
      details: event.details
    }

    try {
      await fs.mkdir(path.dirname(this.logPath), { recursive: true })
      await fs.appendFile(this.logPath, JSON.stringify(logEntry) + '\n', 'utf-8')
    } catch (error) {
      console.error('Failed to write audit log:', error)
    }
  }

  async getEvents(
    criteria: {
      entityId?: number | string
      action?: string
      userId?: string
      startTime?: number
      endTime?: number
    },
    limit: number = 100
  ): Promise<any[]> {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8')
      const lines = content.trim().split('\n').filter(line => line.length > 0)
      
      const events = lines
        .map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        })
        .filter(event => {
          if (!event) return false
          if (criteria.entityId && event.entityId !== criteria.entityId) return false
          if (criteria.action && event.action !== criteria.action) return false
          if (criteria.userId && event.userId !== criteria.userId) return false
          if (criteria.startTime && event.timestamp < criteria.startTime) return false
          if (criteria.endTime && event.timestamp > criteria.endTime) return false
          return true
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit)
      
      return events
    } catch (error: any) {
      if (error.code === 'ENOENT') return []
      console.error('Failed to read audit log:', error)
      return []
    }
  }
}