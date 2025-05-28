
// Last 5 changes:
// 1. Migrated to new consolidated client approach
// 2. Export most hooks from main api.ts file
// 3. Keep specialized hooks like useAutoGenerateTasks that aren't in main api
// 4. Maintain backward compatibility with existing imports
// 5. Add alias exports for naming consistency

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import { postApiTicketsByTicketIdAutoGenerateTasksMutation } from '../../generated/@tanstack/react-query.gen'
import type {
  PostApiTicketsByTicketIdAutoGenerateTasksData,
  PostApiTicketsByTicketIdAutoGenerateTasksError
} from '../../generated/types.gen'
import { Options } from '../../generated/sdk.gen'

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
  useLinkFilesToTicket,
  useSuggestTasksForTicket,
  useSuggestFilesForTicket,
  useGetTasksForTickets,
  useListTicketsWithTaskCount,
  useListTicketsWithTasks
} from '../api'

// Alias exports for backward compatibility
export {
  useGetProjectTickets as useListTickets,
  useListTicketsWithTaskCount as useListTicketsWithCount,
  useGetTasksForTickets as useBulkTicketTasks,
  useGetTasks as useListTasks
} from '../api'

// Type exports for backward compatibility
import type {
  CreateTicketBody,
  UpdateTicketBody
} from 'shared/src/schemas/ticket.schemas'

// Specialized hook that's not in main api.ts
const TICKET_KEYS = {
  all: ['tickets'] as const,
  tasks: (ticketId: number) => [...TICKET_KEYS.all, 'tasks', ticketId] as const
}

export function useAutoGenerateTasks() {
  const queryClient = useQueryClient()
  const mutationOptions = postApiTicketsByTicketIdAutoGenerateTasksMutation()

  return useMutation<unknown, PostApiTicketsByTicketIdAutoGenerateTasksError, { ticketId: number }>({
    mutationFn: ({ ticketId }) => {
      const opts: Options<PostApiTicketsByTicketIdAutoGenerateTasksData> = {
        path: { ticketId }
      }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, { ticketId }) => {
      queryClient.invalidateQueries({
        queryKey: TICKET_KEYS.tasks(ticketId)
      })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}