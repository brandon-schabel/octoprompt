import { usePromptlianoClientInstance } from '@/context/promptliano-client-context'

// Export hook for accessing the client
export { usePromptlianoClientInstance as usePromptlianoClient }

// Note: Direct promptlianoClient export has been removed.
// Use usePromptlianoClient() hook from context instead for proper context-based client access.
// This ensures the client uses the correct server connection and configuration.
