import { useEffect, useState } from 'react'
import { sidecarManager } from '@/services/sidecar-manager'

//  Tauri sidecar service hook,
export function useSidecarServer() {
  const [isStarting, setIsStarting] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Start the server when the app mounts
    const startServer = async () => {
      setIsStarting(true)
      setError(null)

      try {
        // Check if server is already running
        const healthy = await sidecarManager.checkHealth()
        if (healthy) {
          setIsReady(true)
          setIsStarting(false)
          return
        }

        // Start the server
        await sidecarManager.start()
        setIsReady(true)
      } catch (err) {
        console.error('Failed to start Promptliano server:', err)
        setError(err instanceof Error ? err.message : 'Failed to start server')
      } finally {
        setIsStarting(false)
      }
    }

    // Only start in Tauri context
    if (window.__TAURI__) {
      startServer()
    } else {
      // In web context, assume server is already running
      setIsReady(true)
    }

    // Cleanup on unmount
    return () => {
      // Don't stop the server on unmount, let Tauri handle it on app exit
    }
  }, [])

  return {
    isStarting,
    isReady,
    error,
    restart: async () => {
      setIsStarting(true)
      setError(null)
      try {
        await sidecarManager.stop()
        await sidecarManager.start()
        setIsReady(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to restart server')
      } finally {
        setIsStarting(false)
      }
    }
  }
}
