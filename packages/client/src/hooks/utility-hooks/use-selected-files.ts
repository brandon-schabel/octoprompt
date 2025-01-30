import { useState, useEffect } from 'react'
import { useUpdateActiveProjectTab } from '@/zustand/updaters'
import { ProjectFile } from 'shared'
import { useActiveProjectTab } from '@/zustand/selectors'

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
      const newState: UndoRedoState = {
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

  // IMPORTANT: Removing this means we do NOT lose our entire history every time the component unmounts.
  // If you need partial cleanup, handle it more carefully instead of clearing everything.
  /*
  useEffect(() => {
    return () => {
      historyCache.clear()
    }
  }, [])
  */

  // The actual 'selectedFiles' is whatever is at the current index, or empty array if not initialized
  const selectedFiles = undoRedoState?.history[undoRedoState.index] ?? []

  // Only allow operations once we have initialized the state
  const isInitialized = undoRedoState !== null

  // Commit a new selection to local history, and also update global selection
  const commitSelectionChange = (newSelected: string[]) => {
    if (!isInitialized) return

    // Update global store's selection
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
  }

  // Undo: move 'index' back one and update global selection
  const undo = () => {
    if (!isInitialized) return
    setUndoRedoState(currentState => {
      if (!currentState || currentState.index <= 0) return currentState
      const newIndex = currentState.index - 1
      const newSelected = currentState.history[newIndex]

      // Update global selection
      updateActiveProjectTab((prevTab) => ({
        ...prevTab,
        selectedFiles: newSelected,
      }))

      return {
        ...currentState,
        index: newIndex,
      }
    })
  }

  // Redo: move 'index' forward one and update global selection
  const redo = () => {
    if (!isInitialized) return
    setUndoRedoState(currentState => {
      if (!currentState || currentState.index >= currentState.history.length - 1) return currentState
      const newIndex = currentState.index + 1
      const newSelected = currentState.history[newIndex]

      // Update global selection
      updateActiveProjectTab((prevTab) => ({
        ...prevTab,
        selectedFiles: newSelected,
      }))

      return {
        ...currentState,
        index: newIndex,
      }
    })
  }

  // Toggle a single file's selection
  const toggleFile = (fileId: string) => {
    if (!isInitialized) return
    commitSelectionChange(
      selectedFiles.includes(fileId)
        ? selectedFiles.filter(id => id !== fileId)
        : [...selectedFiles, fileId]
    )
  }

  // Remove a file from selection
  const removeSelectedFile = (fileId: string) => {
    if (!isInitialized) return
    commitSelectionChange(selectedFiles.filter(id => id !== fileId))
  }

  // Toggle multiple files at once
  const toggleFiles = (fileIds: string[]) => {
    if (!isInitialized) return
    const toAdd = fileIds.filter(id => !selectedFiles.includes(id))
    const toRemove = fileIds.filter(id => selectedFiles.includes(id))
    commitSelectionChange(
      selectedFiles
        .filter(id => !toRemove.includes(id))
        .concat(toAdd)
    )
  }

  // Select multiple files (replacing current selection)
  const selectFiles = (fileIds: string[]) => {
    if (!isInitialized) return
    commitSelectionChange(fileIds)
  }

  // Clear all selected files
  const clearSelectedFiles = () => {
    if (!isInitialized) return
    commitSelectionChange([])
  }

  // Check if a file is selected
  const isFileSelected = (fileId: string) => {
    return selectedFiles.includes(fileId)
  }

  // Get data for selected files
  const getSelectedFilesData = (fileMap: Map<string, ProjectFile>) => {
    return selectedFiles
      .map(id => fileMap.get(id))
      .filter((file): file is ProjectFile => file !== undefined)
  }

  // Check if we can undo/redo
  const canUndo = undoRedoState !== null && undoRedoState.index > 0

  const canRedo = undoRedoState !== null && undoRedoState.index < undoRedoState.history.length - 1

  return {
    selectedFiles,
    commitSelectionChange,
    undo,
    redo,
    toggleFile,
    removeSelectedFile,
    toggleFiles,
    selectFiles,
    clearSelectedFiles,
    isFileSelected,
    getSelectedFilesData,
    canUndo,
    canRedo,
  }
}

export type UseSelectedFileReturn = ReturnType<typeof useSelectedFiles>