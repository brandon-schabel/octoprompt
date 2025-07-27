import { useMutation } from '@tanstack/react-query'
import { promptlianoClient } from '../promptliano-client'
import type { BrowseDirectoryRequest, DirectoryEntry } from '@promptliano/schemas'

export function useBrowseDirectory() {
  return useMutation({
    mutationFn: (data?: BrowseDirectoryRequest) => promptlianoClient.system.browseDirectory(data),
    onError: (error) => {
      console.error('Failed to browse directory:', error)
    }
  })
}
