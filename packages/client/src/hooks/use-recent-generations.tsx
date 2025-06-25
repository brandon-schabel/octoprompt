import { useLocalStorage } from './utility-hooks/use-local-storage'

export interface RecentGeneration {
  id: string
  assetType: string
  name: string
  content: string
  timestamp: number
}

const MAX_RECENT_GENERATIONS = 10

export function useRecentGenerations() {
  const [recentGenerations, setRecentGenerations] = useLocalStorage<RecentGeneration[]>('RECENT_ASSET_GENERATIONS', [])

  const addGeneration = (assetType: string, name: string, content: string) => {
    const newGeneration: RecentGeneration = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      assetType,
      name,
      content,
      timestamp: Date.now()
    }

    setRecentGenerations((prev) => {
      const updated = [newGeneration, ...prev]
      // Keep only the most recent generations
      return updated.slice(0, MAX_RECENT_GENERATIONS)
    })
  }

  const removeGeneration = (id: string) => {
    setRecentGenerations((prev) => prev.filter((gen) => gen.id !== id))
  }

  const clearAll = () => {
    setRecentGenerations([])
  }

  return {
    recentGenerations,
    addGeneration,
    removeGeneration,
    clearAll
  }
}
