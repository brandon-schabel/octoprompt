import { useCallback, useMemo } from 'react'
import { useLocalStorage } from './utility-hooks/use-local-storage'
import type { ClaudeCommand, CommandGenerationRequest } from '@promptliano/schemas'

interface CommandGenerationCache {
  request: CommandGenerationRequest
  generatedCommand: ClaudeCommand
  timestamp: number
  projectId: number
}

interface CachedCommands {
  [key: string]: CommandGenerationCache
}

const CACHE_KEY = 'promptliano-command-generation-cache'
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_CACHED_COMMANDS = 10

export function useCommandGenerationCache(projectId: number) {
  const [cache, setCache] = useLocalStorage<CachedCommands>(CACHE_KEY, {})

  // Clean up expired entries
  const cleanupExpiredEntries = useCallback(() => {
    const now = Date.now()
    setCache((currentCache) => {
      const updatedCache = { ...currentCache }
      let hasChanges = false

      Object.entries(updatedCache).forEach(([key, entry]) => {
        if (now - entry.timestamp > CACHE_EXPIRY_MS) {
          delete updatedCache[key]
          hasChanges = true
        }
      })

      return hasChanges ? updatedCache : currentCache
    })
  }, [setCache])

  // Get cache key for a request
  const getCacheKey = useCallback(
    (request: CommandGenerationRequest) => {
      return `${projectId}-${request.name}-${request.scope || 'project'}`
    },
    [projectId]
  )

  // Save generated command to cache
  const cacheCommand = useCallback(
    (request: CommandGenerationRequest, command: ClaudeCommand) => {
      const key = getCacheKey(request)

      setCache((currentCache) => {
        const updatedCache = { ...currentCache }

        // Add new entry
        updatedCache[key] = {
          request,
          generatedCommand: command,
          timestamp: Date.now(),
          projectId
        }

        // Limit cache size - remove oldest entries if needed
        const entries = Object.entries(updatedCache)
        if (entries.length > MAX_CACHED_COMMANDS) {
          const sortedEntries = entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
          const entriesToKeep = sortedEntries.slice(0, MAX_CACHED_COMMANDS)
          return Object.fromEntries(entriesToKeep)
        }

        return updatedCache
      })
    },
    [getCacheKey, setCache, projectId]
  )

  // Get cached command
  const getCachedCommand = useCallback(
    (request: CommandGenerationRequest): CommandGenerationCache | null => {
      cleanupExpiredEntries()
      const key = getCacheKey(request)
      const cached = cache[key]

      if (!cached) return null

      // Check if expired
      if (Date.now() - cached.timestamp > CACHE_EXPIRY_MS) {
        return null
      }

      return cached
    },
    [cache, getCacheKey, cleanupExpiredEntries]
  )

  // Get recent generated commands for current project
  const getRecentCommands = useMemo((): CommandGenerationCache[] => {
    cleanupExpiredEntries()

    return Object.values(cache)
      .filter((entry) => entry.projectId === projectId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5) // Return last 5 commands
  }, [cache, projectId, cleanupExpiredEntries])

  // Clear cache for specific command
  const clearCachedCommand = useCallback(
    (request: CommandGenerationRequest) => {
      const key = getCacheKey(request)
      setCache((currentCache) => {
        const updatedCache = { ...currentCache }
        delete updatedCache[key]
        return updatedCache
      })
    },
    [getCacheKey, setCache]
  )

  // Clear all cache for current project
  const clearProjectCache = useCallback(() => {
    setCache((currentCache) => {
      const updatedCache = { ...currentCache }
      Object.entries(updatedCache).forEach(([key, entry]) => {
        if (entry.projectId === projectId) {
          delete updatedCache[key]
        }
      })
      return updatedCache
    })
  }, [setCache, projectId])

  return {
    cacheCommand,
    getCachedCommand,
    getRecentCommands,
    clearCachedCommand,
    clearProjectCache
  }
}
