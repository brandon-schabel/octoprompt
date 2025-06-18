import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useActiveProjectTab,
  useProjectTabField,
  useUpdateActiveProjectTab,
  useUpdateProjectTabById
} from '@/hooks/use-kv-local-storage'
import { useGetProjectFilesWithoutContent, useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { useMemo } from 'react'
import { buildProjectFileMapWithoutContent, buildProjectFileMap } from '@octoprompt/shared'

const MAX_HISTORY_SIZE = 50

type UndoRedoState = {
  history: number[][]
  index: number
}

// Query key factory for type safety
const undoRedoKeys = {
  all: ['undoRedo'] as const,
  tab: (tabId: number) => [...undoRedoKeys.all, tabId] as const
}

export const useProjectFileMapWithoutContent = (projectId: number) => {
  const { data: fileData } = useGetProjectFilesWithoutContent(projectId)
  return useMemo(() => buildProjectFileMapWithoutContent(fileData?.data ?? []), [fileData?.data])
}

export const useProjectFileMap = (projectId: number) => {
  // Add validation to prevent calling with invalid project IDs
  const isValidProjectId = projectId && projectId !== -1 && projectId > 0

  if (!isValidProjectId) {
    console.warn(`useProjectFileMap: Invalid projectId ${projectId}, returning empty map`)
    console.trace('Stack trace for invalid projectId call:')
    return useMemo(() => new Map(), [projectId])
  }

  const { data: fileData, isLoading, error } = useGetProjectFiles(projectId)

  if (error) {
    console.error('useProjectFileMap error:', error)
    console.trace('Stack trace for error:')
  }

  console.log('useProjectFileMap debug:', {
    projectId,
    fileData: fileData?.data,
    fileDataLength: fileData?.data?.length,
    isLoading,
    error
  })

  return useMemo(() => {
    const files = fileData?.data ?? []

    if (files.length > 0) {
      console.log('Building project file map with', files.length, 'files')
      console.log('First file sample:', files[0])
    } else {
      console.log('No files to build map with')
    }

    const map = buildProjectFileMap(files)
    console.log('Generated project file map size:', map.size)
    return map
  }, [fileData?.data])
}

// Hook for managing file selection with undo/redo support
// Supports both active project tab and specific tab IDs for chat functionality
export function useSelectedFiles({
  tabId = null
}: {
  tabId?: number | null
} = {}) {
  const queryClient = useQueryClient()
  const [activeProjectTabState, , activeProjectTabId] = useActiveProjectTab()
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const { updateProjectTabById } = useUpdateProjectTabById()

  // Use the passed tabId if available, otherwise fall back to active tab
  const effectiveTabId = tabId ?? activeProjectTabId
  const effectiveTabState = tabId
    ? useProjectTabField('selectedFiles', tabId).data
    : activeProjectTabState?.selectedFiles

  // Get all project files and build the file map
  const projectId = activeProjectTabState?.selectedProjectId ?? -1
  console.log('useSelectedFiles debug:', {
    projectId,
    activeProjectTabState: activeProjectTabState?.selectedProjectId,
    effectiveTabId
  })
  const projectFileMap = useProjectFileMap(projectId)

  // Query for getting the undo/redo state
  const { data: undoRedoState } = useQuery({
    queryKey: undoRedoKeys.tab(effectiveTabId ?? -1),
    queryFn: () => {
      // Initialize new state if we have selectedFiles
      if (effectiveTabState !== null) {
        return {
          history: [effectiveTabState || []],
          index: 0
        } satisfies UndoRedoState
      }
      return null
    },
    enabled: !!effectiveTabId,
    staleTime: Infinity // Keep the data fresh indefinitely since we manage updates manually
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
    }
  })

  // The actual 'selectedFiles' is whatever is at the current index, or empty array if not initialized
  const selectedFiles: number[] = undoRedoState?.history[undoRedoState.index] ?? []

  // Only allow operations once we have initialized the state
  const isInitialized = undoRedoState !== null

  // Commit a new selection to local history, and also update global selection
  const commitSelectionChange = (newSelected: number[]) => {
    if (!isInitialized || !undoRedoState || !effectiveTabId) return

    // Update global store's selection based on which tab we're working with
    if (tabId) {
      updateProjectTabById(tabId, {
        selectedFiles: newSelected
      })
    } else {
      updateActiveProjectTab({
        selectedFiles: newSelected
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
      index: truncated.length - 1
    })
  }

  // Undo: move 'index' back one and update global selection
  const undo = () => {
    if (!isInitialized || !undoRedoState || undoRedoState.index <= 0) return

    const newIndex = undoRedoState.index - 1
    const newSelected = undoRedoState.history[newIndex]

    // Update global selection based on which tab we're working with
    if (tabId) {
      updateProjectTabById(tabId, {
        selectedFiles: newSelected
      })
    } else {
      updateActiveProjectTab((prevTab) => ({
        ...prevTab,
        selectedFiles: newSelected
      }))
    }

    updateUndoRedoState({
      history: undoRedoState.history,
      index: newIndex
    })
  }

  // Redo: move 'index' forward one and update global selection
  const redo = () => {
    if (!isInitialized || !undoRedoState || undoRedoState.index >= undoRedoState.history.length - 1) return

    const newIndex = undoRedoState.index + 1
    const newSelected = undoRedoState.history[newIndex]

    // Update global selection based on which tab we're working with
    if (tabId) {
      updateProjectTabById(tabId, {
        selectedFiles: newSelected
      })
    } else {
      updateActiveProjectTab((prevTab) => ({
        ...prevTab,
        selectedFiles: newSelected
      }))
    }

    updateUndoRedoState({
      history: undoRedoState.history,
      index: newIndex
    })
  }

  // Toggle a single file's selection
  const toggleFile = (fileId: number) => {
    if (!isInitialized) return
    commitSelectionChange(
      selectedFiles.includes(fileId) ? selectedFiles.filter((id) => id !== fileId) : [...selectedFiles, fileId]
    )
  }

  // Remove a file from selection
  const removeSelectedFile = (fileId: number) => {
    if (!isInitialized) return
    commitSelectionChange(selectedFiles.filter((id) => id !== fileId))
  }

  // Toggle multiple files at once
  const toggleFiles = (fileIds: number[]) => {
    if (!isInitialized) return
    const toAdd = fileIds.filter((id) => !selectedFiles.includes(id))
    const toRemove = fileIds.filter((id) => selectedFiles.includes(id))
    commitSelectionChange(selectedFiles.filter((id) => !toRemove.includes(id)).concat(toAdd))
  }

  // Select multiple files (replacing current selection)
  const selectFiles = (fileIdsOrUpdater: number[] | ((prev: number[]) => number[])) => {
    if (!isInitialized) return
    const newFileIds = typeof fileIdsOrUpdater === 'function' ? fileIdsOrUpdater(selectedFiles) : fileIdsOrUpdater
    commitSelectionChange(newFileIds)
  }

  // Clear all selected files
  const clearSelectedFiles = () => {
    if (!isInitialized) return
    commitSelectionChange([])
  }

  // Check if a file is selected
  const isFileSelected = (fileId: number) => {
    return selectedFiles.includes(fileId)
  }

  // Check if we can undo/redo
  const canUndo = undoRedoState !== null && (undoRedoState?.index ?? 0) > 0
  const canRedo = undoRedoState !== null && (undoRedoState?.index ?? 0) < (undoRedoState?.history?.length ?? 0) - 1

  return {
    selectedFiles: selectedFiles ?? [],
    projectFileMap,
    commitSelectionChange,
    undo,
    redo,
    toggleFile,
    removeSelectedFile,
    toggleFiles,
    selectFiles,
    clearSelectedFiles,
    isFileSelected,
    canUndo,
    canRedo
  }
}

export type UseSelectedFileReturn = ReturnType<typeof useSelectedFiles>
