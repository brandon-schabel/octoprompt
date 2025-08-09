import { usePromptlianoClient } from '@/context/promptliano-client-context'

/**
 * Hook for accessing server connection status and management
 */
export function useServerConnection() {
  const {
    serverUrl,
    setServerUrl,
    connectionStatus,
    connectionError,
    testConnection,
    savedServers,
    addSavedServer,
    removeSavedServer,
    reconnect
  } = usePromptlianoClient()

  return {
    serverUrl,
    setServerUrl,
    connectionStatus,
    connectionError,
    isConnected: connectionStatus === 'connected',
    isConnecting: connectionStatus === 'connecting',
    isDisconnected: connectionStatus === 'disconnected',
    hasError: connectionStatus === 'error',
    testConnection,
    savedServers,
    addSavedServer,
    removeSavedServer,
    reconnect
  }
}
