import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useActiveProjectTab,
  useProjectTabField,
  useUpdateActiveProjectTab,
  useUpdateProjectTabById
} from '@/hooks/use-kv-local-storage'
import { useGetProjectFilesWithoutContent, useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { useMemo } from 'react'
import { buildProjectFileMapWithoutContent, buildProjectFileMap } from '@promptliano/shared'
import { useClaudeMdDetection } from './use-claude-md-detection'
import {
  useInstructionFileDetection,
  type InstructionFileType,
  type DetectedInstructionFile
} from './use-instruction-file-detection'
import { toast } from 'sonner'

const MAX_HISTORY_SIZE = 50
const USE_PATH_BASED_SELECTION = true // Feature flag for gradual rollout

type UndoRedoState = {
  history: { ids: number[]; paths: string[] }[]
  index: number
}

// Query key factory for type safety
const undoRedoKeys = {
  all: ['undoRedo'] as const,
  tab: (tabId: number) => [...undoRedoKeys.all, tabId] as const
}

export const useProjectFileMapWithoutContent = (projectId: number) => {
  // Add validation to prevent calling with invalid project IDs
  const isValidProjectId = projectId && projectId !== -1 && projectId > 0

  // useGetProjectFilesWithoutContent already has built-in validation for projectId
  const { data: fileData } = useGetProjectFilesWithoutContent(projectId)

  return useMemo(() => {
    if (!isValidProjectId) {
      return new Map()
    }
    return buildProjectFileMapWithoutContent(fileData ?? [])
  }, [fileData, isValidProjectId])
}

export const useProjectFileMap = (projectId: number) => {
  // Add validation to prevent calling with invalid project IDs
  const isValidProjectId = projectId && projectId !== -1 && projectId > 0

  // useGetProjectFiles already has built-in validation for projectId
  // It won't fetch if projectId is invalid
  const { data: fileData } = useGetProjectFiles(projectId)

  return useMemo(() => {
    if (!isValidProjectId) {
      return new Map()
    }

    const files = fileData ?? []
    const map = buildProjectFileMap(files)
    return map
  }, [fileData, isValidProjectId])
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

  // NEW: Get paths from state
  const effectivePathState = tabId
    ? useProjectTabField('selectedFilePaths', tabId).data
    : activeProjectTabState?.selectedFilePaths

  // Get all project files and build the file map
  const projectId = activeProjectTabState?.selectedProjectId ?? -1
  const projectFileMap = useProjectFileMap(projectId)

  // Get all project files for CLAUDE.md detection
  const { data: projectFilesData } = useGetProjectFiles(projectId)
  const projectFiles = projectFilesData ?? []

  // Initialize CLAUDE.md detection (kept for backward compatibility)
  const { getClaudeMdForFile } = useClaudeMdDetection(projectFiles)

  // Initialize instruction file detection
  const {
    getInstructionFilesForFile,
    getBestInstructionFile,
    getProjectRootInstructionFiles,
    getInstructionFilesInHierarchy
  } = useInstructionFileDetection(projectFiles)

  // Get the auto-include settings
  const autoIncludeClaudeMd = activeProjectTabState?.autoIncludeClaudeMd ?? false
  const instructionFileSettings = activeProjectTabState?.instructionFileSettings
  const shouldAutoInclude = instructionFileSettings?.autoIncludeEnabled ?? autoIncludeClaudeMd // Fall back to old setting

  // NEW: Build bidirectional path<->ID mapping
  const { pathToId, idToPath } = useMemo(() => {
    const pathToId = new Map<string, number>()
    const idToPath = new Map<number, string>()

    for (const [id, file] of projectFileMap) {
      pathToId.set(file.path, id)
      idToPath.set(id, file.path)
    }

    return { pathToId, idToPath }
  }, [projectFileMap])

  // Query for getting the undo/redo state
  const { data: undoRedoState } = useQuery({
    queryKey: undoRedoKeys.tab(effectiveTabId ?? -1),
    queryFn: () => {
      // Initialize new state if we have selectedFiles or selectedFilePaths
      if (effectiveTabState !== null || effectivePathState !== null) {
        // Convert legacy ID-only state to include paths
        const ids = effectiveTabState || []
        const paths = effectivePathState || (ids.map((id) => idToPath.get(id)).filter(Boolean) as string[])

        return {
          history: [{ ids, paths }],
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

  // Get current selections from history
  const currentHistory = undoRedoState?.history[undoRedoState.index] || { ids: [], paths: [] }
  const selectedFiles: number[] = currentHistory.ids
  const selectedFilePaths: string[] = currentHistory.paths

  // Only allow operations once we have initialized the state
  const isInitialized = undoRedoState !== null

  // Unified commit function that handles both IDs and paths
  const commitSelectionChange = (newIds?: number[], newPaths?: string[]) => {
    if (!isInitialized || !undoRedoState || !effectiveTabId) return

    // Convert between formats as needed
    if (USE_PATH_BASED_SELECTION) {
      // Prefer paths, derive IDs
      if (newPaths && !newIds) {
        newIds = newPaths.map((path) => pathToId.get(path)).filter(Boolean) as number[]
      }
    } else {
      // Legacy: Prefer IDs, derive paths
      if (newIds && !newPaths) {
        newPaths = newIds.map((id) => idToPath.get(id)).filter(Boolean) as string[]
      }
    }

    // Ensure both are arrays
    newIds = newIds || []
    newPaths = newPaths || []

    // Update storage with both formats for compatibility
    const updateData = {
      selectedFiles: newIds,
      selectedFilePaths: newPaths
    }

    if (tabId) {
      updateProjectTabById(tabId, updateData)
    } else {
      updateActiveProjectTab(updateData)
    }

    // Push this new selection onto our history stack
    const { history, index } = undoRedoState
    const truncated = history.slice(0, index + 1)
    truncated.push({ ids: newIds, paths: newPaths })
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
    const { ids, paths } = undoRedoState.history[newIndex]

    // Update storage with both formats
    const updateData = {
      selectedFiles: ids,
      selectedFilePaths: paths
    }

    if (tabId) {
      updateProjectTabById(tabId, updateData)
    } else {
      updateActiveProjectTab(updateData)
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
    const { ids, paths } = undoRedoState.history[newIndex]

    // Update storage with both formats
    const updateData = {
      selectedFiles: ids,
      selectedFilePaths: paths
    }

    if (tabId) {
      updateProjectTabById(tabId, updateData)
    } else {
      updateActiveProjectTab(updateData)
    }

    updateUndoRedoState({
      history: undoRedoState.history,
      index: newIndex
    })
  }

  // Toggle a single file's selection
  const toggleFile = (fileId: number) => {
    if (!isInitialized) return

    if (USE_PATH_BASED_SELECTION) {
      // Convert to path-based operation
      const path = idToPath.get(fileId)
      if (path) {
        toggleFilePath(path)
      }
    } else {
      // Legacy behavior
      const newIds = selectedFiles.includes(fileId)
        ? selectedFiles.filter((id) => id !== fileId)
        : [...selectedFiles, fileId]
      commitSelectionChange(newIds)
    }
  }

  // NEW: Path-based toggle function with instruction file auto-inclusion
  const toggleFilePath = (filePath: string) => {
    if (!isInitialized) return

    const isSelected = selectedFilePaths.includes(filePath)
    let newPaths: string[]

    if (isSelected) {
      // Removing file - just remove it (don't auto-remove instruction files)
      newPaths = selectedFilePaths.filter((p) => p !== filePath)
    } else {
      // Adding file - check for instruction file auto-inclusion
      newPaths = [...selectedFilePaths, filePath]

      // Auto-include instruction files if enabled
      if (shouldAutoInclude) {
        // Use new settings if available, otherwise fall back to CLAUDE.md only
        if (instructionFileSettings?.autoIncludeEnabled) {
          const enabledTypes = (instructionFileSettings.fileTypes || ['claude']) as InstructionFileType[]
          const priority = (instructionFileSettings.priority || 'claude') as InstructionFileType

          const addedFiles: string[] = []

          // Check if we should include the full hierarchy or just the immediate directory
          const includeHierarchy = instructionFileSettings.includeHierarchy ?? true

          let instructionFilesToAdd: DetectedInstructionFile[] = []

          if (includeHierarchy) {
            // Get instruction files from the entire hierarchy (from file up to project root)
            // This will include all CLAUDE.md files in parent directories
            instructionFilesToAdd = getInstructionFilesInHierarchy(
              filePath,
              enabledTypes,
              priority,
              instructionFileSettings.includeProjectRoot ?? true,
              instructionFileSettings.includeGlobal ?? false
            )
          } else {
            // Only get instruction files from the same directory as the selected file
            const result = getInstructionFilesForFile(filePath, enabledTypes, priority)
            instructionFilesToAdd = result.instructionFiles

            // Also include project root files if enabled (even without hierarchy)
            if (instructionFileSettings.includeProjectRoot ?? true) {
              const rootFiles = getProjectRootInstructionFiles(enabledTypes)
              instructionFilesToAdd = [...instructionFilesToAdd, ...rootFiles]
            }
          }

          // Add all instruction files found
          for (const instructionFile of instructionFilesToAdd) {
            if (!newPaths.includes(instructionFile.file.path)) {
              newPaths.push(instructionFile.file.path)

              // Determine the relative location for better toast messages
              const fileDir = filePath.substring(0, filePath.lastIndexOf('/'))
              const instructionDir = instructionFile.file.path.substring(0, instructionFile.file.path.lastIndexOf('/'))

              let location = ''
              if (instructionDir === fileDir) {
                location = 'same directory'
              } else if (instructionDir === '/' || instructionFile.file.path.startsWith('/CLAUDE.md')) {
                location = 'project root'
              } else {
                // Show relative path
                const relativePath = instructionDir.startsWith(fileDir)
                  ? instructionDir.substring(fileDir.length + 1)
                  : instructionDir
                location = relativePath || 'parent directory'
              }

              addedFiles.push(`${instructionFile.file.name} (${location})`)
            }
          }

          // Show toast notification if files were added
          if (addedFiles.length > 0) {
            toast.info('Auto-included instruction files', {
              description:
                addedFiles.length > 3
                  ? `Added ${addedFiles.length} instruction files from hierarchy`
                  : `Added: ${addedFiles.join(', ')}`,
              duration: 2000
            })
          }
        } else {
          // Fall back to old CLAUDE.md behavior for backward compatibility
          const claudeMdResult = getClaudeMdForFile(filePath)
          if (claudeMdResult.hasClaudeMd && claudeMdResult.claudeMdFile) {
            const claudeMdPath = claudeMdResult.claudeMdFile.path

            // Only add if not already selected
            if (!newPaths.includes(claudeMdPath)) {
              newPaths.push(claudeMdPath)

              // Show toast notification
              toast.info('Auto-included CLAUDE.md', {
                description: `Added context file from ${claudeMdPath.substring(0, claudeMdPath.lastIndexOf('/'))}`,
                duration: 2000
              })
            }
          }
        }
      }
    }

    commitSelectionChange(undefined, newPaths)
  }

  // Remove a file from selection
  const removeSelectedFile = (fileId: number) => {
    if (!isInitialized) return

    if (USE_PATH_BASED_SELECTION) {
      const path = idToPath.get(fileId)
      if (path) {
        // File exists - remove by path
        const newPaths = selectedFilePaths.filter((p) => p !== path)
        commitSelectionChange(undefined, newPaths)
      } else {
        // File doesn't exist - remove by filtering both arrays directly
        const newIds = selectedFiles.filter((id) => id !== fileId)
        // Find corresponding path by index (if paths and IDs are synced)
        const fileIndex = selectedFiles.indexOf(fileId)
        const newPaths =
          fileIndex !== -1 ? selectedFilePaths.filter((_, index) => index !== fileIndex) : selectedFilePaths
        commitSelectionChange(newIds, newPaths)
      }
    } else {
      commitSelectionChange(selectedFiles.filter((id) => id !== fileId))
    }
  }

  // Toggle multiple files at once
  const toggleFiles = (fileIds: number[]) => {
    if (!isInitialized) return

    if (USE_PATH_BASED_SELECTION) {
      // Convert to paths
      const paths = fileIds.map((id) => idToPath.get(id)).filter(Boolean) as string[]
      const toAdd = paths.filter((p) => !selectedFilePaths.includes(p))
      const toRemove = paths.filter((p) => selectedFilePaths.includes(p))
      const newPaths = selectedFilePaths.filter((p) => !toRemove.includes(p)).concat(toAdd)
      commitSelectionChange(undefined, newPaths)
    } else {
      const toAdd = fileIds.filter((id) => !selectedFiles.includes(id))
      const toRemove = fileIds.filter((id) => selectedFiles.includes(id))
      commitSelectionChange(selectedFiles.filter((id) => !toRemove.includes(id)).concat(toAdd))
    }
  }

  // Select multiple files (replacing current selection)
  const selectFiles = (fileIdsOrUpdater: number[] | ((prev: number[]) => number[])) => {
    if (!isInitialized) return

    if (USE_PATH_BASED_SELECTION) {
      // Convert to paths
      const newIds = typeof fileIdsOrUpdater === 'function' ? fileIdsOrUpdater(selectedFiles) : fileIdsOrUpdater
      const newPaths = newIds.map((id) => idToPath.get(id)).filter(Boolean) as string[]
      commitSelectionChange(newIds, newPaths)
    } else {
      // Legacy
      const newFileIds = typeof fileIdsOrUpdater === 'function' ? fileIdsOrUpdater(selectedFiles) : fileIdsOrUpdater
      commitSelectionChange(newFileIds)
    }
  }

  // NEW: Path-based select function
  const selectFilePaths = (paths: string[]) => {
    if (!isInitialized) return
    commitSelectionChange(undefined, paths)
  }

  // Clear all selected files
  const clearSelectedFiles = () => {
    if (!isInitialized) return
    commitSelectionChange([], [])
  }

  // Clear only removed files (files that no longer exist)
  const clearRemovedFiles = () => {
    if (!isInitialized) return

    // Filter out files that don't exist in the project anymore
    const validIds = selectedFiles.filter((id) => projectFileMap.has(id))
    const validPaths = selectedFilePaths.filter((path) => pathToId.has(path))

    // Only update if there were actually removed files
    if (validIds.length !== selectedFiles.length || validPaths.length !== selectedFilePaths.length) {
      commitSelectionChange(validIds, validPaths)
    }
  }

  // Check if a file is selected
  const isFileSelected = (fileId: number) => {
    return selectedFiles.includes(fileId)
  }

  // NEW: Check if a file is selected by path
  const isFileSelectedByPath = (path: string) => {
    return selectedFilePaths.includes(path)
  }

  // Check if we can undo/redo
  const canUndo = undoRedoState !== null && (undoRedoState?.index ?? 0) > 0
  const canRedo = undoRedoState !== null && (undoRedoState?.index ?? 0) < (undoRedoState?.history?.length ?? 0) - 1

  return {
    // Legacy (for backward compatibility)
    selectedFiles: selectedFiles ?? [],
    toggleFile,
    removeSelectedFile,
    toggleFiles,
    selectFiles,
    isFileSelected,

    // Path-based (NEW - preferred)
    selectedFilePaths: selectedFilePaths ?? [],
    toggleFilePath,
    selectFilePaths,
    isFileSelectedByPath,

    // Shared
    projectFileMap,
    pathToId,
    idToPath,
    commitSelectionChange,
    undo,
    redo,
    clearSelectedFiles,
    clearRemovedFiles,
    canUndo,
    canRedo
  }
}

export type UseSelectedFileReturn = ReturnType<typeof useSelectedFiles>
