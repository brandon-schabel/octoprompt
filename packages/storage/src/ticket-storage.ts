import { z } from 'zod'
import path from 'node:path'
import { TicketSchema, type Ticket } from '@octoprompt/schemas'
import { BaseStorage, type StorageOptions } from './core/base-storage'
import { STORAGE_CONFIG } from './config'

// Storage schema
export const TicketsStorageSchema = z.record(z.string(), TicketSchema)
export type TicketsStorage = z.infer<typeof TicketsStorageSchema>

/**
 * Simplified ticket storage using the new indexed storage base class
 */
export class TicketStorage extends BaseStorage<Ticket, TicketsStorage> {
  constructor(options: StorageOptions = {}) {
    const dataDir = path.join('data', 'ticket_storage')
    super(TicketsStorageSchema, TicketSchema, dataDir, options)
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
    const all = await this.list()
    const lowercaseQuery = query.toLowerCase()
    return all
      .filter(ticket => ticket.title.toLowerCase().includes(lowercaseQuery))
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get tickets by project
   */
  public async getByProject(projectId: number): Promise<Ticket[]> {
    const all = await this.list()
    return all
      .filter(ticket => ticket.projectId === projectId)
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get tickets by status
   */
  public async getByStatus(status: string): Promise<Ticket[]> {
    const all = await this.list()
    return all
      .filter(ticket => ticket.status === status)
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get tickets by priority
   */
  public async getByPriority(priority: string): Promise<Ticket[]> {
    const all = await this.list()
    return all
      .filter(ticket => ticket.priority === priority)
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get tickets by assignee
   */
  public async getByAssignee(assignee: string): Promise<Ticket[]> {
    const all = await this.list()
    return all
      .filter(ticket => ticket.assignee === assignee)
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get tickets due in date range
   */
  public async getDueInRange(start: Date, end: Date): Promise<Ticket[]> {
    const all = await this.list()
    const startMs = start.getTime()
    const endMs = end.getTime()
    return all
      .filter(ticket => ticket.dueDate && ticket.dueDate >= startMs && ticket.dueDate <= endMs)
      .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
  }

  /**
   * Get overdue tickets
   */
  public async getOverdue(): Promise<Ticket[]> {
    const now = new Date()
    const tickets = await this.getDueInRange(new Date(0), now)
    return tickets.filter((t) => t.status !== 'closed' && t.status !== 'resolved')
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
      unassigned: tickets.filter((t) => !t.assignee).length
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
