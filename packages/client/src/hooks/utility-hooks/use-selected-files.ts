import { useState, useCallback, useMemo, useEffect } from 'react'
import { useUpdateActiveProjectTab } from '@/components/global-state/global-helper-hooks'
import { ProjectFile } from 'shared'
import { useActiveProjectTab } from '@/components/global-state/websocket-selector-hoooks'

const MAX_HISTORY_SIZE = 50

type UndoRedoState = {
  history: string[][]
  index: number
}

// Keep history cache in module scope memory
const historyCache = new Map<string, UndoRedoState>()

export function useSelectedFiles() {
  const { id: activeProjectTabId, tabData: activeProjectTabState } = useActiveProjectTab()
  const updateActiveProjectTab = useUpdateActiveProjectTab()

  // Keep undo/redo history in local state
  const [undoRedoState, setUndoRedoState] = useState<UndoRedoState | null>(null)

  // Effect to handle tab changes and initialize from cache if available
  useEffect(() => {
    if (!activeProjectTabId) {
      setUndoRedoState(null)
      return
    }

    // Check cache first
    const cachedState = historyCache.get(activeProjectTabId)
    if (cachedState) {
      setUndoRedoState(cachedState)
      return
    }

    // Initialize new state if we have selectedFiles
    if (activeProjectTabState?.selectedFiles !== null) {
      const newState = {
        history: [activeProjectTabState?.selectedFiles || []],
        index: 0,
      }
      historyCache.set(activeProjectTabId, newState)
      setUndoRedoState(newState)
    }
  }, [activeProjectTabId, activeProjectTabState?.selectedFiles])

  // Update cache whenever undoRedoState changes
  useEffect(() => {
    if (undoRedoState && activeProjectTabId) {
      historyCache.set(activeProjectTabId, undoRedoState)
    }
  }, [undoRedoState, activeProjectTabId])

  // Cleanup cache when component unmounts
  useEffect(() => {
    return () => {
      historyCache.clear()
    }
  }, [])

  // The actual 'selectedFiles' is whatever is at the current index, or empty array if not initialized
  const selectedFiles = useMemo(() => {
    return undoRedoState?.history[undoRedoState.index] ?? []
  }, [undoRedoState])

  // Only allow operations once we have initialized the state
  const isInitialized = undoRedoState !== null

  // Commit a new selection to local history, and also update global selection
  const commitSelectionChange = useCallback((newSelected: string[]) => {
    if (!isInitialized) return

    // Update global store's selection (no more history indexing there)
    updateActiveProjectTab((prevTab) => ({
      ...prevTab,
      selectedFiles: newSelected,
    }))

    // Push this new selection onto our local history stack
    setUndoRedoState(currentState => {
      if (!currentState) return currentState
      const { history, index } = currentState
      const truncated = history.slice(0, index + 1)
      truncated.push(newSelected)
      if (truncated.length > MAX_HISTORY_SIZE) {
        truncated.shift()
      }
      return {
        history: truncated,
        index: truncated.length - 1,
      }
    })
  }, [isInitialized, updateActiveProjectTab])

  // Undo: just move 'index' back one and update global selection
  const undo = useCallback(() => {
    if (!undoRedoState) return

    setUndoRedoState((state): UndoRedoState => {
      if (!state) return undoRedoState
      const { history, index } = state
      if (index <= 0) {
        return state
      }
      const newIndex = index - 1
      updateActiveProjectTab((prevTab) => ({
        ...prevTab,
        selectedFiles: history[newIndex],
      }))
      return { history, index: newIndex }
    })
  }, [undoRedoState, updateActiveProjectTab])

  // Redo: just move 'index' forward one and update global selection
  const redo = useCallback(() => {
    if (!undoRedoState) return

    setUndoRedoState((state): UndoRedoState => {
      if (!state) return undoRedoState
      const { history, index } = state
      if (index >= history.length - 1) {
        return state
      }
      const newIndex = index + 1
      updateActiveProjectTab((prevTab) => ({
        ...prevTab,
        selectedFiles: history[newIndex],
      }))
      return { history, index: newIndex }
    })
  }, [undoRedoState, updateActiveProjectTab])

  // Basic selection helpers
  const toggleFile = useCallback((fileId: string) => {
    if (!isInitialized) return
    const newSet = new Set(selectedFiles)
    if (newSet.has(fileId)) {
      newSet.delete(fileId)
    } else {
      newSet.add(fileId)
    }
    commitSelectionChange([...newSet])
  }, [selectedFiles, commitSelectionChange, isInitialized])

  const removeSelectedFile = useCallback((fileId: string) => {
    if (!isInitialized) return
    commitSelectionChange(selectedFiles.filter(id => id !== fileId))
  }, [selectedFiles, commitSelectionChange, isInitialized])

  const toggleFiles = useCallback((fileIds: string[]) => {
    if (!isInitialized) return
    const newSet = new Set(selectedFiles)
    fileIds.forEach(id => {
      newSet.has(id) ? newSet.delete(id) : newSet.add(id)
    })
    commitSelectionChange([...newSet])
  }, [selectedFiles, commitSelectionChange, isInitialized])

  const selectFiles = useCallback((fileIds: string[]) => {
    if (!isInitialized) return
    commitSelectionChange(fileIds)
  }, [commitSelectionChange, isInitialized])

  const clearSelectedFiles = useCallback(() => {
    if (!isInitialized) return
    commitSelectionChange([])
  }, [commitSelectionChange, isInitialized])

  // Utilities
  const isFileSelected = useCallback((fileId: string) => {
    return selectedFiles.includes(fileId)
  }, [selectedFiles])

  const getSelectedFilesData = useCallback((fileMap: Map<string, ProjectFile>) => {
    return selectedFiles
      .map(id => fileMap.get(id))
      .filter((file): file is ProjectFile => file !== undefined)
  }, [selectedFiles])

  const canUndo = useMemo(() => {
    return undoRedoState !== null && undoRedoState.index > 0
  }, [undoRedoState])
  const canRedo = useMemo(() => {
    return undoRedoState !== null && undoRedoState.index < undoRedoState.history.length - 1
  }, [undoRedoState])

  return {
    selectedFiles,
    toggleFile,
    toggleFiles,
    selectFiles,
    clearSelectedFiles,
    isFileSelected,
    getSelectedFilesData,
    removeSelectedFile,
    commitSelectionChange,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}

export type UseSelectedFileReturn = ReturnType<typeof useSelectedFiles>