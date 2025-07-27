import { QueryClient } from '@tanstack/react-query'
import { promptlianoClient } from '@/hooks/promptliano-client'

/**
 * Loader for project data that prefetches using TanStack Query
 * This ensures data is available before the component renders
 */
export async function projectLoader({
  context,
  params
}: { context: { queryClient: QueryClient }; params: Record<string, any> }) {
  const projectId = params.projectId as number

  if (!projectId) return null

  // Prefetch project data
  await context.queryClient.ensureQueryData({
    queryKey: ['project', projectId],
    queryFn: () => promptlianoClient.projects.getProject(projectId),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  // Prefetch project files in parallel
  await Promise.all([
    context.queryClient.prefetchQuery({
      queryKey: ['projectFiles', projectId],
      queryFn: () => promptlianoClient.projects.getProjectFiles(projectId),
      staleTime: 2 * 60 * 1000 // 2 minutes
    }),
    context.queryClient.prefetchQuery({
      queryKey: ['projectSummary', projectId],
      queryFn: () => promptlianoClient.projects.getProjectSummary(projectId),
      staleTime: 10 * 60 * 1000 // 10 minutes
    })
  ])

  return { projectId }
}

/**
 * Loader for tickets data with search params
 */
export async function ticketsLoader({
  context,
  params,
  search
}: {
  context: { queryClient: QueryClient }
  params: Record<string, any>
  search: { status?: string; priority?: string; offset?: number; limit?: number }
}) {
  const projectId = params.projectId as number

  if (!projectId) return null

  const { status, priority, offset = 0, limit = 20 } = search

  await context.queryClient.ensureQueryData({
    queryKey: ['tickets', projectId, { status, priority, offset, limit }],
    queryFn: () => promptlianoClient.tickets.listTickets(projectId),
    staleTime: 30 * 1000 // 30 seconds
  })

  return { projectId, filters: { status, priority, offset, limit } }
}

/**
 * Loader dependencies helper
 * Extracts only the values that should trigger a reload
 */
export function createLoaderDeps<T extends Record<string, any>>(selector: (search: T) => Partial<T>) {
  return ({ search }: { search: T }) => selector(search)
}

/**
 * Helper to create a composite loader that runs multiple loaders in parallel
 */
export function composeLoaders<T extends Record<string, any>>(
  ...loaders: Array<(args: { context: T; params: Record<string, any>; search?: any }) => Promise<any>>
) {
  return async (args: { context: T; params: Record<string, any>; search?: any }) => {
    const results = await Promise.all(loaders.map((loader) => loader(args)))
    return Object.assign({}, ...results)
  }
}
