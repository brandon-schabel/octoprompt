import { ticketStorage } from '@octoprompt/storage'
import {
  type CreateTicketBody,
  type UpdateTicketBody,
  type Ticket,
  TicketSchema
} from '@octoprompt/schemas'
import { BaseService } from './core/base-service'
import { safeAsync } from './utils/error-handlers'
import { bulkUpdate } from './utils/bulk-operations'

/**
 * Simplified ticket service using the new base service class
 */
class TicketService extends BaseService<Ticket, CreateTicketBody, UpdateTicketBody> {
  protected entityName = 'ticket'
  protected storage = ticketStorage

  /**
   * Create a ticket with automatic project association
   */
  async createTicket(data: CreateTicketBody): Promise<Ticket> {
    return this.create(data)
  }

  /**
   * Get tickets by project
   */
  async getProjectTickets(projectId: number): Promise<Ticket[]> {
    return safeAsync(
      () => ticketStorage.getByProject(projectId),
      {
        entityName: 'tickets',
        action: 'fetching by project',
        details: { projectId }
      }
    )
  }

  /**
   * Get tickets by assignee
   */
  async getAssignedTickets(assignee: string): Promise<Ticket[]> {
    return safeAsync(
      () => ticketStorage.getByAssignee(assignee),
      {
        entityName: 'tickets',
        action: 'fetching by assignee',
        details: { assignee }
      }
    )
  }

  /**
   * Get overdue tickets
   */
  async getOverdueTickets(): Promise<Ticket[]> {
    return safeAsync(
      () => ticketStorage.getOverdue(),
      {
        entityName: 'tickets',
        action: 'fetching overdue'
      }
    )
  }

  /**
   * Bulk update ticket status
   */
  async bulkUpdateStatus(ticketIds: number[], status: string): Promise<Ticket[]> {
    return safeAsync(
      async () => {
        const updates = ticketIds.map(id => ({ id, data: { status } }))
        const result = await bulkUpdate(
          updates,
          (id, data) => this.update(id, data)
        )
        return result.succeeded
      },
      {
        entityName: 'tickets',
        action: 'bulk updating status',
        details: { count: ticketIds.length, status }
      }
    )
  }

  /**
   * Reassign tickets in bulk
   */
  async bulkReassign(ticketIds: number[], assignee: string): Promise<Ticket[]> {
    return safeAsync(
      async () => {
        const updates = ticketIds.map(id => ({ id, data: { assignee } }))
        const result = await bulkUpdate(
          updates,
          (id, data) => this.update(id, data)
        )
        return result.succeeded
      },
      {
        entityName: 'tickets',
        action: 'bulk reassigning',
        details: { count: ticketIds.length, assignee }
      }
    )
  }

  /**
   * Search tickets by title
   */
  async searchTickets(query: string): Promise<Ticket[]> {
    return safeAsync(
      () => ticketStorage.searchByTitle(query),
      {
        entityName: 'tickets',
        action: 'searching',
        details: { query }
      }
    )
  }

  /**
   * Get ticket statistics
   */
  async getTicketStats() {
    return safeAsync(
      () => ticketStorage.getStats(),
      {
        entityName: 'ticket statistics',
        action: 'calculating'
      }
    )
  }

  /**
   * Close ticket with resolution
   */
  async closeTicket(ticketId: number, resolution: string): Promise<Ticket> {
    return this.update(ticketId, {
      status: 'closed',
      resolution,
      closedAt: Date.now()
    })
  }

  /**
   * Reopen ticket
   */
  async reopenTicket(ticketId: number): Promise<Ticket> {
    return this.update(ticketId, {
      status: 'open',
      closedAt: undefined,
      resolution: undefined
    })
  }
}

// Export singleton instance
export const ticketService = new TicketService()