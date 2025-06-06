import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
// import { Options } from '../../generated/sdk.gen'

// Re-export all main ticket hooks from the main api file
export {
  useGetProjectTickets,
  useGetTicket,
  useGetTasks,
  useCreateTicket,
  useUpdateTicket,
  useDeleteTicket,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useReorderTasks,
  useAutoGenerateTasks,
  useLinkFilesToTicket,
  useSuggestTasksForTicket,
  useSuggestFilesForTicket,
  useGetTasksForTickets,
  useListTicketsWithTaskCount,
  useListTicketsWithTasks,
  useInvalidateTickets
} from '../api-hooks'

// Alias exports for backward compatibility
export {
  useGetProjectTickets as useListTickets,
  useListTicketsWithTaskCount as useListTicketsWithCount,
  useGetTasksForTickets as useBulkTicketTasks,
  useGetTasks as useListTasks
} from '../api-hooks'

// Type exports for backward compatibility
import type {
  CreateTicketBody,
  UpdateTicketBody
} from '@octoprompt/schemas'

// Specialized hook that's not in main api.ts
const TICKET_KEYS = {
  all: ['tickets'] as const,
  tasks: (ticketId: number) => [...TICKET_KEYS.all, 'tasks', ticketId] as const
}

// The useAutoGenerateTasks hook is now available from the main api.ts file
// No need for a separate implementation here since it's exported above