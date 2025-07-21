import { useCallback } from 'react'
import { useGetKvValue, useSetKvValue } from './use-kv-local-storage'

const MAX_RECENT_PROJECTS = 5

export function useRecentProjects() {
  const [recentProjects] = useGetKvValue('recentProjects')
  const { mutate: setRecentProjects } = useSetKvValue('recentProjects')

  const addRecentProject = useCallback(
    (projectId: number) => {
      setRecentProjects((prev) => {
        // If the project is already the most recent, don't update
        if (prev[0] === projectId) {
          return prev
        }

        const filtered = prev.filter((id) => id !== projectId)
        const updated = [projectId, ...filtered].slice(0, MAX_RECENT_PROJECTS)
        return updated
      })
    },
    [setRecentProjects]
  )

  const removeRecentProject = useCallback(
    (projectId: number) => {
      setRecentProjects((prev) => {
        const updated = prev.filter((id) => id !== projectId)
        return updated
      })
    },
    [setRecentProjects]
  )

  const clearRecentProjects = useCallback(() => {
    setRecentProjects([])
  }, [setRecentProjects])

  return {
    recentProjects,
    addRecentProject,
    removeRecentProject,
    clearRecentProjects
  }
}
