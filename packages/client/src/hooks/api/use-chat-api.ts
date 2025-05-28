

// Last 5 changes:
// 1. Migrated to new consolidated client approach 
// 2. Export hooks from main api.ts file
// 3. Keep specialized useGetModels hook for provider-specific queries
// 4. Maintain backward compatibility with existing imports
// 5. Simplified query key management

import { useQuery } from '@tanstack/react-query'
import { getApiModelsOptions } from '../../generated/@tanstack/react-query.gen'
import { APIProviders } from 'shared/src/schemas/provider-key.schemas'

// Re-export all chat hooks from the main api file
export {
  useGetChats,
  useGetChat,
  useGetMessages,
  useCreateChat,
  useUpdateChat,
  useDeleteChat,
  useForkChat,
  useForkChatFromMessage,
  useDeleteMessage,
  useStreamChat,
  useAIChatV2
} from '../api'

// Specialized hook that's not in main api.ts
export function useGetModels(provider: APIProviders) {
  const queryOptions = getApiModelsOptions({ query: { provider } })
  return useQuery(queryOptions)
}