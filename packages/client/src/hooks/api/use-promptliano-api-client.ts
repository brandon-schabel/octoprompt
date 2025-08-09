import { usePromptlianoClientInstance } from '@/context/promptliano-client-context'

/**
 * Hook to get the Promptliano API client instance from context
 * This replaces the direct import of promptlianoClient
 *
 * @example
 * const promptlianoClient = usePromptlianoApiClient()
 * const projects = await promptlianoClient.projects.listProjects()
 */
export function usePromptlianoApiClient() {
  return usePromptlianoClientInstance()
}
