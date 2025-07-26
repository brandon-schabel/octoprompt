import { useNavigate as useRouterNavigate } from '@tanstack/react-router'
import type { RegisteredRouter } from '@tanstack/react-router'

/**
 * Type-safe navigation hook that ensures search params are properly typed
 * This wrapper provides better type inference for search params
 */
export function useTypedNavigate() {
  const navigate = useRouterNavigate()

  return {
    navigate,

    // Helper to navigate to projects with proper search params
    toProjects: (params?: { projectId?: number; tab?: string }) => {
      navigate({
        to: '/projects',
        search: params
      })
    },

    // Helper to navigate to chat with proper search params
    toChat: (params?: { chatId?: number; prefill?: boolean }) => {
      navigate({
        to: '/chat',
        search: params
      })
    },

    // Helper to navigate to a specific project tab
    toProjectTab: (projectId: number, tab: string) => {
      navigate({
        to: '/projects',
        search: { projectId, tab }
      })
    }
  }
}

/**
 * Hook to get current search params with proper typing
 */
export function useTypedSearch<T extends Record<string, any>>() {
  const { useSearch } = useRouterNavigate() as any
  return useSearch() as T
}
