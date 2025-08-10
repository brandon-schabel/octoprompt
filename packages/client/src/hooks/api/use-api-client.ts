import { usePromptlianoClient } from '@/context/promptliano-client-context'
import type { PromptlianoClient } from '@promptliano/api-client'

/**
 * Hook to safely get the API client for use in React Query hooks
 * Returns the client or null if not connected
 *
 * Migration Notes:
 * - Changed from Proxy pattern to nullable return (Phase 1.1 of migration)
 * - All hooks must now handle null client gracefully
 * - Use `enabled: !!client` in useQuery calls to prevent execution when disconnected
 *
 * @returns PromptlianoClient instance or null if disconnected
 */
export function useApiClient(): PromptlianoClient | null {
  const { client } = usePromptlianoClient()
  return client
}
