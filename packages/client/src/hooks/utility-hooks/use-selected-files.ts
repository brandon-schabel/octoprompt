import { useGlobalStateHelpers } from '@/components/use-global-state-helpers'
import { useCallback } from 'react'
import { ProjectFile } from 'shared'

const MAX_HISTORY_SIZE = 50

export function useSelectedFiles() {
  const { activeProjectTabState: activeTabState, updateActiveProjectTab: updateActiveTab } = useGlobalStateHelpers()
  const selectedFiles = activeTabState?.selectedFiles || []
  const history = activeTabState?.selectedFilesHistory ?? [[]]
  const historyIndex = activeTabState?.selectedFilesHistoryIndex ?? 0

  // currentSelection is whatever is in selectedFiles for convenience,
  // but we can also treat the "official" selection as `history[historyIndex]`.
  // It's typically a good idea to keep `selectedFiles` always synced with `history[historyIndex]`.

  // Commits a new array of selected files to the global store’s history
  const commitSelectionChange = useCallback((newSelected: string[]) => {
    updateActiveTab((prevTab) => {
      const prevHistory = prevTab.selectedFilesHistory ?? [[]]
      const prevIndex = prevTab.selectedFilesHistoryIndex ?? 0

      // 1) Cut off any "future" states if we had undone some changes
      const truncated = prevHistory.slice(0, prevIndex + 1)

      // 2) Add the new selection
      truncated.push(newSelected)

      // 3) Possibly limit the total length
      if (truncated.length > MAX_HISTORY_SIZE) {
        truncated.shift()
      }

      // 4) The new index is the last item
      const newIndex = truncated.length - 1

      return {
        ...prevTab,
        // Always keep selectedFiles in sync with the new state
        selectedFiles: newSelected,

        // Update our history
        selectedFilesHistory: truncated,
        selectedFilesHistoryIndex: newIndex,
      }
    })
  }, [updateActiveTab])

  // Undo
  const undo = useCallback(() => {
    updateActiveTab((prevTab) => {
      const prevIndex = prevTab.selectedFilesHistoryIndex ?? 0
      if (prevIndex <= 0) return prevTab // can't undo

      const newIndex = prevIndex - 1
      const nextHistory = prevTab.selectedFilesHistory ?? [[]]
      const undoneSelection = nextHistory[newIndex] ?? []

      return {
        ...prevTab,
        selectedFiles: undoneSelection,
        selectedFilesHistoryIndex: newIndex,
      }
    })
  }, [updateActiveTab])

  // Redo
  const redo = useCallback(() => {
    updateActiveTab((prevTab) => {
      const prevIndex = prevTab.selectedFilesHistoryIndex ?? 0
      const nextHistory = prevTab.selectedFilesHistory ?? [[]]

      if (prevIndex >= nextHistory.length - 1) return prevTab // can't redo

      const newIndex = prevIndex + 1
      const redoneSelection = nextHistory[newIndex] ?? []

      return {
        ...prevTab,
        selectedFiles: redoneSelection,
        selectedFilesHistoryIndex: newIndex,
      }
    })
  }, [updateActiveTab])

  // Normal selection methods (all calling commitSelectionChange)
  const toggleFile = useCallback((fileId: string) => {
    const newSet = new Set(selectedFiles)
    if (newSet.has(fileId)) {
      newSet.delete(fileId)
    } else {
      newSet.add(fileId)
    }
    commitSelectionChange([...newSet])
  }, [selectedFiles, commitSelectionChange])

  const removeSelectedFile = useCallback((fileId: string) => {
    commitSelectionChange(selectedFiles.filter(id => id !== fileId))
  }, [selectedFiles, commitSelectionChange])

  const toggleFiles = useCallback((fileIds: string[]) => {
    const newSet = new Set(selectedFiles)
    fileIds.forEach(id => {
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
    })
    commitSelectionChange([...newSet])
  }, [selectedFiles, commitSelectionChange])

  const selectFiles = useCallback((fileIds: string[]) => {
    commitSelectionChange(fileIds)
  }, [commitSelectionChange])

  const clearSelectedFiles = useCallback(() => {
    commitSelectionChange([])
  }, [commitSelectionChange])

  // Helpers
  const isFileSelected = useCallback((fileId: string) => {
    return selectedFiles.includes(fileId)
  }, [selectedFiles])

  const getSelectedFilesData = useCallback((fileMap: Map<string, ProjectFile>): ProjectFile[] => {
    return selectedFiles
      .map(id => fileMap.get(id))
      .filter((file): file is ProjectFile => file !== undefined)
  }, [selectedFiles])

  // For convenience, we can define whether we can undo/redo
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < (history.length - 1)



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