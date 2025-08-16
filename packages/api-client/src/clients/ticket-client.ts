import { z } from 'zod'
import { BaseApiClient } from '../base-client'
import type { 
  CreateTicketBody,
  UpdateTicketBody,
  CreateTaskBody,
  UpdateTaskBody,
  Ticket,
  TicketTask,
  TicketWithTasks,
  TicketWithTaskCount,
  DataResponseSchema
} from '../types'

// Import schemas
import {
  CreateTicketBodySchema,
  UpdateTicketBodySchema,
  CreateTaskBodySchema,
  UpdateTaskBodySchema,
  ReorderTasksBodySchema,
  TicketSchema,
  TicketTaskSchema,
  TicketWithTasksSchema,
  TicketWithTaskCountSchema,
  SuggestTasksBodySchema,
  TicketSuggestFilesBodySchema,
  OperationSuccessResponseSchema as OperationSuccessResponseSchemaZ
} from '@promptliano/schemas'
import type { ReorderTasksBody } from '@promptliano/schemas'

// Additional types for ticket operations

/**
 * Ticket API client for managing tickets, tasks, and AI-powered suggestions
 */
export class TicketClient extends BaseApiClient {
  /**
   * List tickets for a project with optional status filter
   */
  async listTickets(projectId: number, status?: string): Promise<DataResponseSchema<Ticket[]>> {
    const params: Record<string, any> = {}
    if (status) params.status = status

    const result = await this.request('GET', `/projects/${projectId}/tickets`, {
      params,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(TicketSchema)
      })
    })
    return result as DataResponseSchema<Ticket[]>
  }

  /**
   * Create a new ticket
   */
  async createTicket(data: CreateTicketBody): Promise<DataResponseSchema<Ticket>> {
    const validatedData = this.validateBody(CreateTicketBodySchema, data)
    const result = await this.request('POST', '/tickets', {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: TicketSchema
      })
    })
    return result as DataResponseSchema<Ticket>
  }

  /**
   * Get a ticket by ID
   */
  async getTicket(ticketId: number): Promise<DataResponseSchema<Ticket>> {
    const result = await this.request('GET', `/tickets/${ticketId}`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: TicketSchema
      })
    })
    return result as DataResponseSchema<Ticket>
  }

  /**
   * Update a ticket
   */
  async updateTicket(ticketId: number, data: UpdateTicketBody): Promise<DataResponseSchema<Ticket>> {
    const validatedData = this.validateBody(UpdateTicketBodySchema, data)
    const result = await this.request('PATCH', `/tickets/${ticketId}`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: TicketSchema
      })
    })
    return result as DataResponseSchema<Ticket>
  }

  /**
   * Complete a ticket and get updated ticket with tasks
   */
  async completeTicket(ticketId: number): Promise<DataResponseSchema<{ ticket: Ticket; tasks: TicketTask[] }>> {
    const result = await this.request('POST', `/tickets/${ticketId}/complete`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          ticket: TicketSchema,
          tasks: z.array(TicketTaskSchema)
        })
      })
    })
    return result as DataResponseSchema<{ ticket: Ticket; tasks: TicketTask[] }>
  }

  /**
   * Delete a ticket
   */
  async deleteTicket(ticketId: number): Promise<boolean> {
    await this.request('DELETE', `/tickets/${ticketId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  // Task operations

  /**
   * Get all tasks for a ticket
   */
  async getTasks(ticketId: number): Promise<DataResponseSchema<TicketTask[]>> {
    const result = await this.request('GET', `/tickets/${ticketId}/tasks`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(TicketTaskSchema)
      })
    })
    return result as DataResponseSchema<TicketTask[]>
  }

  /**
   * Create a new task for a ticket
   */
  async createTask(ticketId: number, data: CreateTaskBody): Promise<DataResponseSchema<TicketTask>> {
    const validatedData = this.validateBody(CreateTaskBodySchema, data)
    const result = await this.request('POST', `/tickets/${ticketId}/tasks`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: TicketTaskSchema
      })
    })
    return result as DataResponseSchema<TicketTask>
  }

  /**
   * Update a task
   */
  async updateTask(ticketId: number, taskId: number, data: UpdateTaskBody): Promise<DataResponseSchema<TicketTask>> {
    const validatedData = this.validateBody(UpdateTaskBodySchema, data)
    const result = await this.request('PATCH', `/tickets/${ticketId}/tasks/${taskId}`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: TicketTaskSchema
      })
    })
    return result as DataResponseSchema<TicketTask>
  }

  /**
   * Delete a task
   */
  async deleteTask(ticketId: number, taskId: number): Promise<boolean> {
    await this.request('DELETE', `/tickets/${ticketId}/tasks/${taskId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  /**
   * Reorder tasks within a ticket
   */
  async reorderTasks(ticketId: number, data: ReorderTasksBody): Promise<DataResponseSchema<TicketTask[]>> {
    const validatedData = this.validateBody(ReorderTasksBodySchema, data)
    const result = await this.request('PATCH', `/tickets/${ticketId}/tasks/reorder`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(TicketTaskSchema)
      })
    })
    return result as DataResponseSchema<TicketTask[]>
  }

  // AI-powered operations

  /**
   * Get AI-suggested tasks for a ticket
   */
  async suggestTasks(ticketId: number, userContext?: string): Promise<{ success: boolean; data: { suggestedTasks: string[] } }> {
    const validatedData = this.validateBody(SuggestTasksBodySchema, { userContext })
    const result = await this.request('POST', `/tickets/${ticketId}/suggest-tasks`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          suggestedTasks: z.array(z.string())
        })
      })
    })
    return result as { success: boolean; data: { suggestedTasks: string[] } }
  }

  /**
   * Auto-generate tasks for a ticket using AI
   */
  async autoGenerateTasks(ticketId: number): Promise<DataResponseSchema<TicketTask[]>> {
    const result = await this.request('POST', `/tickets/${ticketId}/auto-generate-tasks`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(TicketTaskSchema)
      })
    })
    return result as DataResponseSchema<TicketTask[]>
  }

  /**
   * Get AI-suggested files for a ticket
   */
  async suggestFiles(ticketId: number, extraUserInput?: string): Promise<{
    success: boolean
    data: {
      recommendedFileIds: string[]
      combinedSummaries?: string
      message?: string
    }
  }> {
    const validatedData = this.validateBody(TicketSuggestFilesBodySchema, { extraUserInput })
    const result = await this.request('POST', `/tickets/${ticketId}/suggest-files`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          recommendedFileIds: z.array(z.string()),
          combinedSummaries: z.string().optional(),
          message: z.string().optional()
        })
      })
    })
    return result as {
      success: boolean
      data: {
        recommendedFileIds: string[]
        combinedSummaries?: string
        message?: string
      }
    }
  }

  // Bulk operations

  /**
   * Get tickets with task counts for a project
   */
  async getTicketsWithCounts(projectId: number, status?: string): Promise<DataResponseSchema<TicketWithTaskCount[]>> {
    const params: Record<string, any> = {}
    if (status) params.status = status

    const result = await this.request('GET', `/projects/${projectId}/tickets-with-count`, {
      params,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(TicketWithTaskCountSchema)
      })
    })
    return result as DataResponseSchema<TicketWithTaskCount[]>
  }

  /**
   * Get tickets with all their tasks for a project
   */
  async getTicketsWithTasks(projectId: number, status?: string): Promise<DataResponseSchema<TicketWithTasks[]>> {
    const params: Record<string, any> = {}
    if (status) params.status = status

    const result = await this.request('GET', `/projects/${projectId}/tickets-with-tasks`, {
      params,
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(TicketWithTasksSchema)
      })
    })
    return result as DataResponseSchema<TicketWithTasks[]>
  }
}