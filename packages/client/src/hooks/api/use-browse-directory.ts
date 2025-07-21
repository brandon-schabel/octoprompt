import { useMutation } from '@tanstack/react-query'
import { octoClient } from '../octo-client'
import type { BrowseDirectoryRequest, DirectoryEntry } from '@octoprompt/schemas'

export function useBrowseDirectory() {
  return useMutation({
    mutationFn: (data?: BrowseDirectoryRequest) => octoClient.system.browseDirectory(data),
    onError: (error) => {
      console.error('Failed to browse directory:', error)
    }
  })
}
