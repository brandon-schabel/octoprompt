import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateRequiredParam,
  validateDataField,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse,
  TicketManagerAction,
  TicketManagerSchema
} from '../shared'
import {
  createTicket,
  getTicketById,
  listTicketsByProject,
  updateTicket,
  deleteTicket,
  listTicketsWithTaskCount,
  suggestTasksForTicket,
  autoGenerateTasksFromOverview,
  suggestFilesForTicket,
  searchTickets,
  batchCreateTickets,
  batchUpdateTickets,
  batchDeleteTickets
} from '@promptliano/services'
import type { CreateTicketBody, UpdateTicketBody } from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'

export const ticketManagerTool: MCPToolDefinition = {
  name: 'ticket_manager',
  description:
    'Manage tickets and ticket-related operations. Actions: list, get, create, update, delete, list_with_task_count, suggest_tasks, auto_generate_tasks, suggest_files, search, batch_create, batch_update, batch_delete',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(TicketManagerAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for: list, create, list_with_task_count). Example: 1754713756748'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For get/update/delete: { ticketId: 456 }. For create: { title: "Fix bug", overview: "Description", priority: "high", status: "open", suggestedAgentIds: ["planning-architect"], suggestedPromptIds: [123] }. For search: { query: "login", status: "open", priority: ["high", "normal"], limit: 10 }. For batch_create: { tickets: [{title: "Task 1"}, {title: "Task 2"}] }. For batch_update: { updates: [{ticketId: 456, data: {status: "closed"}}] }. For batch_delete: { ticketIds: [456, 789] }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'ticket_manager',
    async (args: z.infer<typeof TicketManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case TicketManagerAction.LIST: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754713756748')
            const status = data?.status as string | undefined
            const tickets = await listTicketsByProject(validProjectId, status)
            const ticketList = tickets
              .map(
                (t) =>
                  `${t.id}: ${t.title} [${t.status}/${t.priority}] - ${(t.overview || '').substring(0, 50)}${(t.overview || '').length > 50 ? '...' : ''}`
              )
              .join('\n')
            return {
              content: [{ type: 'text', text: ticketList || 'No tickets found' }]
            }
          }

          case TicketManagerAction.GET: {
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
            const ticket = await getTicketById(ticketId)
            const details = `Ticket: ${ticket.title}
Project ID: ${ticket.projectId}
Status: ${ticket.status}
Priority: ${ticket.priority}
Overview: ${ticket.overview}
Suggested Files: ${ticket.suggestedFileIds?.join(', ') || 'None'}
Suggested Agents: ${ticket.suggestedAgentIds?.join(', ') || 'None'}
Suggested Prompts: ${ticket.suggestedPromptIds?.join(', ') || 'None'}
Created: ${new Date(ticket.created).toLocaleString()}
Updated: ${new Date(ticket.updated).toLocaleString()}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case TicketManagerAction.CREATE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754713756748')

            // Validate required fields FIRST
            const title = validateDataField<string>(data, 'title', 'string', '"Fix login bug"')

            // Then create the data object with validated values
            const createData: CreateTicketBody = {
              projectId: validProjectId,
              title: title, // Now guaranteed to be non-empty
              overview: data.overview || '',
              status: data.status || 'open',
              priority: data.priority || 'normal',
              suggestedFileIds: data.suggestedFileIds,
              suggestedAgentIds: data.suggestedAgentIds,
              suggestedPromptIds: data.suggestedPromptIds
            }

            const ticket = await createTicket(createData)
            return {
              content: [{ type: 'text', text: `Ticket created successfully: ${ticket.title} (ID: ${ticket.id})` }]
            }
          }

          case TicketManagerAction.UPDATE: {
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
            const updateData: UpdateTicketBody = {}
            if (data.title !== undefined) updateData.title = data.title
            if (data.overview !== undefined) updateData.overview = data.overview
            if (data.status !== undefined) updateData.status = data.status
            if (data.priority !== undefined) updateData.priority = data.priority
            if (data.suggestedFileIds !== undefined) updateData.suggestedFileIds = data.suggestedFileIds
            if (data.suggestedAgentIds !== undefined) updateData.suggestedAgentIds = data.suggestedAgentIds
            if (data.suggestedPromptIds !== undefined) updateData.suggestedPromptIds = data.suggestedPromptIds
            const ticket = await updateTicket(ticketId, updateData)
            return {
              content: [{ type: 'text', text: `Ticket updated successfully: ${ticket.title} (ID: ${ticketId})` }]
            }
          }

          case TicketManagerAction.DELETE: {
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
            await deleteTicket(ticketId)
            return {
              content: [{ type: 'text', text: `Ticket ${ticketId} deleted successfully` }]
            }
          }

          case TicketManagerAction.LIST_WITH_TASK_COUNT: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754713756748')
            const status = data?.status as string | undefined
            const tickets = await listTicketsWithTaskCount(validProjectId, status)
            const ticketList = tickets
              .map(
                (t) => `${t.id}: ${t.title} [${t.status}/${t.priority}] - Tasks: ${t.completedTaskCount}/${t.taskCount}`
              )
              .join('\n')
            return {
              content: [{ type: 'text', text: ticketList || 'No tickets found' }]
            }
          }

          case TicketManagerAction.SUGGEST_TASKS: {
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
            const userContext = data?.userContext as string | undefined
            const suggestions = await suggestTasksForTicket(ticketId, userContext)
            const suggestionList = suggestions.map((task, idx) => `${idx + 1}. ${task}`).join('\n')
            return {
              content: [{ type: 'text', text: suggestionList || 'No task suggestions generated' }]
            }
          }

          case TicketManagerAction.AUTO_GENERATE_TASKS: {
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')

            try {
              const tasks = await autoGenerateTasksFromOverview(ticketId)
              const taskList = tasks.map((t) => `${t.id}: ${t.content}`).join('\n')
              return {
                content: [{ type: 'text', text: `Generated ${tasks.length} tasks:\n${taskList}` }]
              }
            } catch (error) {
              if (error instanceof ApiError) {
                if (error.status === 404) {
                  throw createMCPError(
                    MCPErrorCode.TICKET_NOT_FOUND,
                    error.message || `Ticket ${ticketId} not found or project has no files`,
                    {
                      ticketId,
                      suggestion: 'Ensure the ticket exists and the associated project has files'
                    }
                  )
                }
                throw createMCPError(MCPErrorCode.SERVICE_ERROR, error.message || 'Failed to generate tasks', {
                  ticketId,
                  code: error.code,
                  originalError: error.message || 'Unknown error'
                })
              }
              throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to auto-generate tasks for ticket', {
                ticketId,
                originalError: error instanceof Error ? error.message : String(error)
              })
            }
          }

          case TicketManagerAction.SUGGEST_FILES: {
            const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
            const extraUserInput = data?.extraUserInput as string | undefined

            try {
              const result = await suggestFilesForTicket(ticketId, { extraUserInput })
              return {
                content: [
                  {
                    type: 'text',
                    text: `Suggested files: ${result.recommendedFileIds.join(', ') || 'None'}\n${result.message || ''}`
                  }
                ]
              }
            } catch (error) {
              if (error instanceof ApiError) {
                if (error.status === 404) {
                  throw createMCPError(
                    MCPErrorCode.TICKET_NOT_FOUND,
                    error.message || `Ticket ${ticketId} not found or project has no files`,
                    {
                      ticketId,
                      suggestion: 'Ensure the ticket exists and the associated project has files'
                    }
                  )
                }
                throw createMCPError(MCPErrorCode.SERVICE_ERROR, error.message || 'Failed to suggest files', {
                  ticketId,
                  code: error.code,
                  originalError: error.message || 'Unknown error'
                })
              }
              throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to suggest files for ticket', {
                ticketId,
                originalError: error instanceof Error ? error.message : String(error)
              })
            }
          }

          case TicketManagerAction.SEARCH: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754713756748')
            const searchOptions = data || {}

            try {
              const result = await searchTickets(validProjectId, searchOptions)

              if (result.tickets.length === 0) {
                throw createMCPError(MCPErrorCode.NO_SEARCH_RESULTS, 'No tickets found matching your search criteria', {
                  searchOptions
                })
              }

              const ticketList = result.tickets.map((t) => `${t.id}: [${t.status}/${t.priority}] ${t.title}`).join('\n')

              return {
                content: [
                  {
                    type: 'text',
                    text: `Found ${result.total} tickets (showing ${result.tickets.length}):\n${ticketList}`
                  }
                ]
              }
            } catch (error) {
              if (error instanceof MCPError) throw error
              throw createMCPError(MCPErrorCode.SEARCH_FAILED, 'Search operation failed', {
                searchOptions,
                originalError: error instanceof Error ? error.message : String(error)
              })
            }
          }

          case TicketManagerAction.BATCH_CREATE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754713756748')
            const tickets = validateDataField<any[]>(data, 'tickets', 'array', '[{title: "Task 1"}, {title: "Task 2"}]')

            if (tickets.length > 100) {
              throw createMCPError(
                MCPErrorCode.BATCH_SIZE_EXCEEDED,
                `Batch size ${tickets.length} exceeds maximum of 100`
              )
            }

            const result = await batchCreateTickets(validProjectId, tickets)

            if (result.failureCount > 0 && result.successCount === 0) {
              throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                failures: result.failed
              })
            }

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Batch create completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                    (result.failed.length > 0
                      ? `Failures:\n${result.failed.map((f) => `- ${JSON.stringify(f.item)}: ${f.error}`).join('\n')}`
                      : '')
                }
              ]
            }
          }

          case TicketManagerAction.BATCH_UPDATE: {
            const updates = validateDataField<any[]>(
              data,
              'updates',
              'array',
              '[{ticketId: 456, data: {status: "closed"}}]'
            )

            if (updates.length > 100) {
              throw createMCPError(
                MCPErrorCode.BATCH_SIZE_EXCEEDED,
                `Batch size ${updates.length} exceeds maximum of 100`
              )
            }

            const result = await batchUpdateTickets(updates)

            if (result.failureCount > 0 && result.successCount === 0) {
              throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                failures: result.failed
              })
            }

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Batch update completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                    (result.failed.length > 0
                      ? `Failures:\n${result.failed.map((f) => `- Ticket ${f.item.ticketId}: ${f.error}`).join('\n')}`
                      : '')
                }
              ]
            }
          }

          case TicketManagerAction.BATCH_DELETE: {
            const ticketIds = validateDataField<number[]>(data, 'ticketIds', 'array', '[456, 789]')

            if (ticketIds.length > 100) {
              throw createMCPError(
                MCPErrorCode.BATCH_SIZE_EXCEEDED,
                `Batch size ${ticketIds.length} exceeds maximum of 100`
              )
            }

            const result = await batchDeleteTickets(ticketIds)

            if (result.failureCount > 0 && result.successCount === 0) {
              throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                failures: result.failed
              })
            }

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Batch delete completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                    (result.failed.length > 0 ? `Failed IDs: ${result.failed.map((f) => f.item).join(', ')}` : '')
                }
              ]
            }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(TicketManagerAction)
            })
        }
      } catch (error) {
        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'ticket_manager',
                action: args.action,
                projectId: args.projectId
              })

        // Return formatted error response with recovery suggestions
        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
