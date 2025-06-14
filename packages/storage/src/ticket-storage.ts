import { z } from 'zod'
import path from 'node:path'
import { TicketSchema, type Ticket } from '@octoprompt/schemas'
import { IndexedStorage } from './core/indexed-storage'
import { type StorageOptions } from './core/base-storage'
import { commonSorters } from './core/storage-query-utils'
import { STORAGE_CONFIG } from './config'

// Storage schema
export const TicketsStorageSchema = z.record(z.string(), TicketSchema)
export type TicketsStorage = z.infer<typeof TicketsStorageSchema>

/**
 * Simplified ticket storage using the new indexed storage base class
 */
export class TicketStorage extends IndexedStorage<Ticket, TicketsStorage> {
  constructor(options: StorageOptions = {}) {
    const dataDir = path.join('data', 'ticket_storage')
    super(TicketsStorageSchema, TicketSchema, dataDir, options)
    
    // Define indexes declaratively
    this.indexDefinitions = [
      { name: 'tickets_by_title', type: 'inverted', fields: ['title'] },
      { name: 'tickets_by_projectId', type: 'hash', fields: ['projectId'] },
      { name: 'tickets_by_status', type: 'hash', fields: ['status'] },
      { name: 'tickets_by_priority', type: 'hash', fields: ['priority'] },
      { name: 'tickets_by_assignee', type: 'hash', fields: ['assignee'], sparse: true },
      { name: 'tickets_by_created', type: 'btree', fields: ['created'] },
      { name: 'tickets_by_updated', type: 'btree', fields: ['updated'] },
      { name: 'tickets_by_dueDate', type: 'btree', fields: ['dueDate'], sparse: true }
    ]
    
    // Initialize indexes
    this.initializeIndexes()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'tickets.json')
  }

  protected getEntityPath(id: number): string | null {
    // Tickets don't have separate entity paths
    return null
  }

  // --- Domain-specific query methods ---

  /**
   * Search tickets by title
   */
  public async searchByTitle(query: string): Promise<Ticket[]> {
    return this.searchByIndex('tickets_by_title', query, commonSorters.byUpdatedDesc)
  }

  /**
   * Get tickets by project
   */
  public async getByProject(projectId: number): Promise<Ticket[]> {
    return this.queryByIndex('tickets_by_projectId', projectId, commonSorters.byUpdatedDesc)
  }

  /**
   * Get tickets by status
   */
  public async getByStatus(status: string): Promise<Ticket[]> {
    return this.queryByIndex('tickets_by_status', status, commonSorters.byUpdatedDesc)
  }

  /**
   * Get tickets by priority
   */
  public async getByPriority(priority: string): Promise<Ticket[]> {
    return this.queryByIndex('tickets_by_priority', priority, commonSorters.byUpdatedDesc)
  }

  /**
   * Get tickets by assignee
   */
  public async getByAssignee(assignee: string): Promise<Ticket[]> {
    return this.queryByIndex('tickets_by_assignee', assignee, commonSorters.byUpdatedDesc)
  }

  /**
   * Get tickets due in date range
   */
  public async getDueInRange(start: Date, end: Date): Promise<Ticket[]> {
    return this.queryByDateRange('tickets_by_dueDate', start, end, (a, b) => (a.dueDate || 0) - (b.dueDate || 0))
  }

  /**
   * Get overdue tickets
   */
  public async getOverdue(): Promise<Ticket[]> {
    const now = new Date()
    const tickets = await this.getDueInRange(new Date(0), now)
    return tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved')
  }

  /**
   * Get tickets statistics
   */
  public async getStats() {
    const tickets = await this.list()
    
    return {
      total: tickets.length,
      byStatus: this.groupBy(tickets, 'status'),
      byPriority: this.groupBy(tickets, 'priority'),
      byProject: this.groupBy(tickets, 'projectId'),
      overdue: (await this.getOverdue()).length,
      unassigned: tickets.filter(t => !t.assignee).length
    }
  }

  private groupBy(items: Ticket[], field: keyof Ticket): Record<string, number> {
    const groups: Record<string, number> = {}
    for (const item of items) {
      const value = String(item[field] || 'unknown')
      groups[value] = (groups[value] || 0) + 1
    }
    return groups
  }
}

// Export singleton instance for backward compatibility
export const ticketStorage = new TicketStorage({
  ...STORAGE_CONFIG,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 200
})