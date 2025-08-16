import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { createPromptlianoClient, PromptlianoClient } from '@promptliano/api-client'
import { useGetAppSettings, useSetKvValue } from '@/hooks/use-kv-local-storage'
import { toast } from 'sonner'

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

export interface SavedServer {
  name: string
  url: string
  isDefault?: boolean
}

interface PromptlianoClientContextValue {
  client: PromptlianoClient | null
  serverUrl: string
  setServerUrl: (url: string) => Promise<void>
  connectionStatus: ConnectionStatus
  connectionError: string | null
  testConnection: (url: string) => Promise<boolean>
  savedServers: SavedServer[]
  addSavedServer: (server: SavedServer) => void
  removeSavedServer: (url: string) => void
  reconnect: () => Promise<void>
}

const PromptlianoClientContext = createContext<PromptlianoClientContextValue | undefined>(undefined)

export function usePromptlianoClient() {
  const context = useContext(PromptlianoClientContext)
  if (!context) {
    throw new Error('usePromptlianoClient must be used within PromptlianoClientProvider')
  }
  return context
}

interface PromptlianoClientProviderProps {
  children: React.ReactNode
}

export function PromptlianoClientProvider({ children }: PromptlianoClientProviderProps) {
  const [appSettings] = useGetAppSettings()
  const { mutate: updateAppSettings } = useSetKvValue('appSettings')

  const [client, setClient] = useState<PromptlianoClient | null>(null)
  const [serverUrl, setServerUrlState] = useState<string>(appSettings?.promptlianoServerUrl || 'http://localhost:3147')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [savedServers, setSavedServers] = useState<SavedServer[]>(appSettings?.promptlianoServerUrls || [])

  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const connectionStatusRef = useRef<ConnectionStatus>('disconnected')
  const maxReconnectAttempts = 5 // Circuit breaker threshold

  // Update connection status ref whenever state changes
  useEffect(() => {
    connectionStatusRef.current = connectionStatus
  }, [connectionStatus])

  // Test connection to a specific URL
  const testConnection = useCallback(async (url: string): Promise<boolean> => {
    try {
      const testClient = createPromptlianoClient({
        baseUrl: url,
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      })

      // Use projects.listProjects as a health check since system.healthCheck is not available in the new API client
      const response = await testClient.projects.listProjects()
      return response && 'success' in response && response.success === true
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }, [])

  // Connect to server
  const connectToServer = useCallback(
    async (url: string) => {
      setConnectionStatus('connecting')
      setConnectionError(null)

      try {
        const newClient = createPromptlianoClient({
          baseUrl: url,
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        })

        // Test the connection
        const isConnected = await testConnection(url)

        if (isConnected) {
          setClient(newClient)
          setClientInstance(newClient) // Set singleton instance for loaders
          setConnectionStatus('connected')
          setConnectionError(null)
          reconnectAttemptsRef.current = 0

          // Start health check polling
          if (healthCheckIntervalRef.current) {
            clearInterval(healthCheckIntervalRef.current)
          }

          healthCheckIntervalRef.current = setInterval(async () => {
            const healthy = await testConnection(url)
            // Use ref to get current connection status
            if (!healthy && connectionStatusRef.current === 'connected') {
              setConnectionStatus('disconnected')
              setConnectionError('Lost connection to server')
              // Attempt to reconnect
              scheduleReconnect()
            } else if (healthy && connectionStatusRef.current === 'disconnected') {
              // Automatically reconnect if server is back
              setConnectionStatus('connected')
              setConnectionError(null)
            }
          }, 30000) // Check every 30 seconds

          return true
        } else {
          throw new Error('Failed to connect to server')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed'
        setConnectionStatus('error')
        setConnectionError(errorMessage)
        setClient(null)
        setClientInstance(null) // Clear singleton instance

        // Schedule reconnect attempt
        scheduleReconnect()

        return false
      }
    },
    [testConnection]
  )

  // Schedule reconnection with exponential backoff and circuit breaker
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    const attempts = reconnectAttemptsRef.current

    // Circuit breaker: stop trying after max attempts
    if (attempts >= maxReconnectAttempts) {
      setConnectionStatus('error')
      setConnectionError(
        `Failed to reconnect after ${maxReconnectAttempts} attempts. Please check your server and try again.`
      )
      return
    }

    const delay = Math.min(1000 * Math.pow(2, attempts), 30000) // Max 30 seconds

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++
      connectToServer(serverUrl)
    }, delay)
  }, [serverUrl, connectToServer])

  // Reconnect manually
  const reconnect = useCallback(async () => {
    reconnectAttemptsRef.current = 0
    await connectToServer(serverUrl)
  }, [serverUrl, connectToServer])

  // Update server URL
  const setServerUrl = useCallback(
    async (url: string) => {
      if (url === serverUrl) return

      // Clear existing connection
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      setServerUrlState(url)

      // Update settings
      updateAppSettings((prev) => ({
        ...prev,
        promptlianoServerUrl: url
      }))

      // Connect to new server
      const connected = await connectToServer(url)

      if (connected) {
        toast.success(`Connected to server at ${url}`)
      } else {
        toast.error(`Failed to connect to server at ${url}`)
      }
    },
    [serverUrl, updateAppSettings, connectToServer]
  )

  // Manage saved servers
  const addSavedServer = useCallback(
    (server: SavedServer) => {
      const newServers = [...savedServers.filter((s) => s.url !== server.url), server]
      setSavedServers(newServers)
      updateAppSettings((prev) => ({
        ...prev,
        promptlianoServerUrls: newServers
      }))
    },
    [savedServers, updateAppSettings]
  )

  const removeSavedServer = useCallback(
    (url: string) => {
      const newServers = savedServers.filter((s) => s.url !== url)
      setSavedServers(newServers)
      updateAppSettings((prev) => ({
        ...prev,
        promptlianoServerUrls: newServers
      }))
    },
    [savedServers, updateAppSettings]
  )

  // Initialize connection on mount
  useEffect(() => {
    const initialUrl = appSettings?.promptlianoServerUrl || 'http://localhost:3147'
    setServerUrlState(initialUrl)
    connectToServer(initialUrl)

    // Cleanup on unmount
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, []) // Only run on mount

  // Update saved servers when app settings change
  useEffect(() => {
    if (appSettings?.promptlianoServerUrls) {
      setSavedServers(appSettings.promptlianoServerUrls)
    }
  }, [appSettings?.promptlianoServerUrls])

  const contextValue: PromptlianoClientContextValue = {
    client,
    serverUrl,
    setServerUrl,
    connectionStatus,
    connectionError,
    testConnection,
    savedServers,
    addSavedServer,
    removeSavedServer,
    reconnect
  }

  return <PromptlianoClientContext.Provider value={contextValue}>{children}</PromptlianoClientContext.Provider>
}

// Export a hook that provides the client directly for compatibility
export function usePromptlianoClientInstance() {
  const { client } = usePromptlianoClient()
  if (!client) {
    throw new Error('Promptliano client is not connected. Please check your server connection.')
  }
  return client
}

// Export a function to get the current client instance for use in loaders
// This is a singleton pattern for route loaders that run outside React context
let currentClientInstance: PromptlianoClient | null = null

export function setClientInstance(client: PromptlianoClient | null) {
  currentClientInstance = client
}

export function getClientInstance(): PromptlianoClient | null {
  return currentClientInstance
}
