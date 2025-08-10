import { useMutation } from '@tanstack/react-query'
import { useApiClient } from './use-api-client'
import type { BrowseDirectoryRequest, DirectoryEntry } from '@promptliano/schemas'

export function useBrowseDirectory() {
  const client = useApiClient()

  return useMutation({
    mutationFn: (data?: BrowseDirectoryRequest) => {
      if (!client) throw new Error('API client not initialized')
      return client.system.browseDirectory(data)
    },
    onError: (error) => {
      console.error('Failed to browse directory:', error)
    }
  })
}
