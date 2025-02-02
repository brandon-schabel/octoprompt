import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUpdateActiveProjectTab, useUpdateProjectTab } from '@/zustand/updaters'
import { ProjectFile, ProjectTabState } from 'shared'
import { useActiveProjectTab } from '@/zustand/selectors'
import { useProjectTabField } from '@/zustand/zustand-utility-hooks'
import { useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { useMemo } from 'react'

const MAX_HISTORY_SIZE = 50

type UndoRedoState = {
  history: string[][]
  index: number
}

// Query key factory for type safety
const undoRedoKeys = {
  all: ['undoRedo'] as const,
  tab: (tabId: string) => [...undoRedoKeys.all, tabId] as const,
}

// TODO Implment the ability to pass in a tab id instead of it just defaulting to the 
// active project tab, becuase it needs to work with chat as well
export function useSelectedFiles({
  tabId = null,
}: {
  tabId?: string | null
} = {}) {
  const queryClient = useQueryClient()
  const { id: activeProjectTabId, tabData: activeProjectTabState, selectedProjectId } = useActiveProjectTab()
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const updateProjectTab = useUpdateProjectTab()

  // Use the passed tabId if available, otherwise fall back to active tab
  const effectiveTabId = tabId ?? activeProjectTabId
  const effectiveTabState = tabId ? useProjectTabField("selectedFiles", tabId).data : activeProjectTabState?.selectedFiles

  // Get all project files and build the file map
  const { data: fileData } = useGetProjectFiles(selectedProjectId || '')
  const fileMap = useMemo(() => {
    const m = new Map<string, ProjectFile>()
    fileData?.files?.forEach(f => m.set(f.id, f))
    return m
  }, [fileData?.files])

  // Query for getting the undo/redo state
  const { data: undoRedoState } = useQuery({
    queryKey: undoRedoKeys.tab(effectiveTabId ?? ''),
    queryFn: () => {
      // Initialize new state if we have selectedFiles
      if (effectiveTabState !== null) {
        return {
          history: [effectiveTabState || []],
          index: 0,
        } satisfies UndoRedoState
      }
      return null
    },
    enabled: !!effectiveTabId,
    staleTime: Infinity, // Keep the data fresh indefinitely since we manage updates manually
  })

  // Mutation for updating the undo/redo state
  const { mutate: updateUndoRedoState } = useMutation({
    mutationFn: (newState: UndoRedoState) => {
      return Promise.resolve(newState)
    },
    onSuccess: (newState) => {
      if (effectiveTabId) {
        queryClient.setQueryData(undoRedoKeys.tab(effectiveTabId), newState)
      }
    },
  })

  // The actual 'selectedFiles' is whatever is at the current index, or empty array if not initialized
  const selectedFiles = undoRedoState?.history[undoRedoState.index] ?? []

  // Only allow operations once we have initialized the state
  const isInitialized = undoRedoState !== null

  // Commit a new selection to local history, and also update global selection
  const commitSelectionChange = (newSelected: string[]) => {
    if (!isInitialized || !undoRedoState || !effectiveTabId) return

    // Update global store's selection based on which tab we're working with
    if (tabId) {
      updateProjectTab(tabId, {
        selectedFiles: newSelected,
      })
    } else {
      updateActiveProjectTab({
        selectedFiles: newSelected,
      })
    }

    // Push this new selection onto our history stack
    const { history, index } = undoRedoState
    const truncated = history.slice(0, index + 1)
    truncated.push(newSelected)
    if (truncated.length > MAX_HISTORY_SIZE) {
      truncated.shift()
    }

    updateUndoRedoState({
      history: truncated,
      index: truncated.length - 1,
    })
  }

  // Undo: move 'index' back one and update global selection
  const undo = () => {
    if (!isInitialized || !undoRedoState || undoRedoState.index <= 0) return

    const newIndex = undoRedoState.index - 1
    const newSelected = undoRedoState.history[newIndex]

    // Update global selection
    updateActiveProjectTab((prevTab) => ({
      ...prevTab,
      selectedFiles: newSelected,
    }))

    updateUndoRedoState({
      history: undoRedoState.history,
      index: newIndex,
    })
  }

  // Redo: move 'index' forward one and update global selection
  const redo = () => {
    if (!isInitialized || !undoRedoState || undoRedoState.index >= undoRedoState.history.length - 1) return

    const newIndex = undoRedoState.index + 1
    const newSelected = undoRedoState.history[newIndex]

    // Update global selection
    updateActiveProjectTab((prevTab) => ({
      ...prevTab,
      selectedFiles: newSelected,
    }))

    updateUndoRedoState({
      history: undoRedoState.history,
      index: newIndex,
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
  const selectFiles = (fileIdsOrUpdater: string[] | ((prev: string[]) => string[])) => {
    if (!isInitialized) return
    const newFileIds = typeof fileIdsOrUpdater === 'function' 
      ? fileIdsOrUpdater(selectedFiles)
      : fileIdsOrUpdater
    commitSelectionChange(newFileIds)
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
  const canUndo = undoRedoState !== null && (undoRedoState?.index ?? 0) > 0
  const canRedo = undoRedoState !== null && (undoRedoState?.index ?? 0) < (undoRedoState?.history?.length ?? 0) - 1

  return {
    selectedFiles: selectedFiles ?? [],
    projectFileMap: fileMap,
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