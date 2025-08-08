# Selected Files Path-Based Implementation Guide

## Quick Start

This guide provides copy-paste ready code snippets for implementing the path-based file selection system.

## Step 1: Schema Updates

### 1.1 Update selected-files.schemas.ts
```typescript
import { z } from 'zod'
import { idSchemaSpec, idArraySchemaSpec, unixTSSchemaSpec } from './schema-utils'

export const selectedFilesDataSchema = z.object({
  projectId: idSchemaSpec,
  tabId: z.number().optional(),
  fileIds: idArraySchemaSpec.default([]), // DEPRECATED: Will be removed in future
  filePaths: z.array(z.string()).default([]), // NEW: Primary selection method
  promptIds: idArraySchemaSpec.default([]),
  userPrompt: z.string().default(''),
  updatedAt: unixTSSchemaSpec
})

// Helper to migrate old data
export const migrateSelectedFilesData = (data: any): z.infer<typeof selectedFilesDataSchema> => {
  const parsed = selectedFilesDataSchema.parse(data)
  // Ensure filePaths exists even for old data
  if (!parsed.filePaths) {
    parsed.filePaths = []
  }
  return parsed
}
```

### 1.2 Update global-state-schema.ts
```typescript
export const projectTabStateSchema = z.object({
  // ... existing fields ...
  selectedFiles: idArraySchemaSpec.default([]), // DEPRECATED: For backward compatibility
  selectedFilePaths: z.array(z.string()).default([]), // NEW: Primary storage
  // ... rest of schema ...
})

// Migration helper
export const migrateProjectTabState = (state: any): ProjectTabState => {
  const parsed = projectTabStateSchema.parse(state)
  if (!parsed.selectedFilePaths && parsed.selectedFiles?.length > 0) {
    // Migration needed - will be handled by migration script
    console.warn('Project tab needs migration from ID to path-based selection')
  }
  return parsed
}
```

## Step 2: Core Hook Implementation

### 2.1 Updated use-selected-files.ts
```typescript
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

const MAX_HISTORY_SIZE = 50
const USE_PATH_BASED_SELECTION = true // Feature flag

type UndoRedoState = {
  history: { ids: number[]; paths: string[] }[]
  index: number
}

export function useSelectedFiles({
  tabId = null
}: {
  tabId?: number | null
} = {}) {
  const queryClient = useQueryClient()
  const [activeProjectTabState, , activeProjectTabId] = useActiveProjectTab()
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const { updateProjectTabById } = useUpdateProjectTabById()

  const effectiveTabId = tabId ?? activeProjectTabId
  const effectiveTabState = tabId
    ? useProjectTabField('selectedFiles', tabId).data
    : activeProjectTabState?.selectedFiles
  
  // NEW: Get paths from state
  const effectivePathState = tabId
    ? useProjectTabField('selectedFilePaths', tabId).data
    : activeProjectTabState?.selectedFilePaths

  const projectId = activeProjectTabState?.selectedProjectId ?? -1
  const projectFileMap = useProjectFileMap(projectId)

  // NEW: Build path<->ID mapping
  const { pathToId, idToPath } = useMemo(() => {
    const pathToId = new Map<string, number>()
    const idToPath = new Map<number, string>()
    
    for (const [id, file] of projectFileMap) {
      pathToId.set(file.path, id)
      idToPath.set(id, file.path)
    }
    
    return { pathToId, idToPath }
  }, [projectFileMap])

  // Initialize undo/redo with both IDs and paths
  const { data: undoRedoState } = useQuery({
    queryKey: ['undoRedo', effectiveTabId],
    queryFn: () => {
      if (effectiveTabState !== null || effectivePathState !== null) {
        // Convert legacy ID-only state to include paths
        const ids = effectiveTabState || []
        const paths = effectivePathState || ids.map(id => idToPath.get(id)).filter(Boolean) as string[]
        
        return {
          history: [{ ids, paths }],
          index: 0
        } satisfies UndoRedoState
      }
      return null
    },
    enabled: !!effectiveTabId,
    staleTime: Infinity
  })

  const { mutate: updateUndoRedoState } = useMutation({
    mutationFn: (newState: UndoRedoState) => Promise.resolve(newState),
    onSuccess: (newState) => {
      if (effectiveTabId) {
        queryClient.setQueryData(['undoRedo', effectiveTabId], newState)
      }
    }
  })

  // Get current selections
  const currentHistory = undoRedoState?.history[undoRedoState.index] || { ids: [], paths: [] }
  const selectedFiles = currentHistory.ids
  const selectedFilePaths = currentHistory.paths

  const isInitialized = undoRedoState !== null

  // Unified commit function that handles both IDs and paths
  const commitSelectionChange = (newIds?: number[], newPaths?: string[]) => {
    if (!isInitialized || !undoRedoState || !effectiveTabId) return

    // Convert between formats as needed
    if (USE_PATH_BASED_SELECTION) {
      // Prefer paths, derive IDs
      if (newPaths && !newIds) {
        newIds = newPaths.map(path => pathToId.get(path)).filter(Boolean) as number[]
      }
    } else {
      // Legacy: Prefer IDs, derive paths
      if (newIds && !newPaths) {
        newPaths = newIds.map(id => idToPath.get(id)).filter(Boolean) as string[]
      }
    }

    // Ensure both are arrays
    newIds = newIds || []
    newPaths = newPaths || []

    // Update storage with both formats
    const updateData = {
      selectedFiles: newIds,
      selectedFilePaths: newPaths
    }

    if (tabId) {
      updateProjectTabById(tabId, updateData)
    } else {
      updateActiveProjectTab(updateData)
    }

    // Update history
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

  // Path-based operations (NEW)
  const toggleFilePath = (filePath: string) => {
    if (!isInitialized) return
    const newPaths = selectedFilePaths.includes(filePath)
      ? selectedFilePaths.filter(p => p !== filePath)
      : [...selectedFilePaths, filePath]
    commitSelectionChange(undefined, newPaths)
  }

  const selectFilePaths = (paths: string[]) => {
    if (!isInitialized) return
    commitSelectionChange(undefined, paths)
  }

  const isFileSelectedByPath = (path: string) => {
    return selectedFilePaths.includes(path)
  }

  // Legacy ID-based operations (keep for compatibility)
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
        ? selectedFiles.filter(id => id !== fileId)
        : [...selectedFiles, fileId]
      commitSelectionChange(newIds)
    }
  }

  const selectFiles = (fileIdsOrUpdater: number[] | ((prev: number[]) => number[])) => {
    if (!isInitialized) return
    
    if (USE_PATH_BASED_SELECTION) {
      // Convert to paths
      const newIds = typeof fileIdsOrUpdater === 'function' 
        ? fileIdsOrUpdater(selectedFiles) 
        : fileIdsOrUpdater
      const newPaths = newIds.map(id => idToPath.get(id)).filter(Boolean) as string[]
      commitSelectionChange(newIds, newPaths)
    } else {
      // Legacy
      const newIds = typeof fileIdsOrUpdater === 'function'
        ? fileIdsOrUpdater(selectedFiles)
        : fileIdsOrUpdater
      commitSelectionChange(newIds)
    }
  }

  // Undo/Redo with both formats
  const undo = () => {
    if (!isInitialized || !undoRedoState || undoRedoState.index <= 0) return

    const newIndex = undoRedoState.index - 1
    const { ids, paths } = undoRedoState.history[newIndex]

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

  const redo = () => {
    if (!isInitialized || !undoRedoState || undoRedoState.index >= undoRedoState.history.length - 1) return

    const newIndex = undoRedoState.index + 1
    const { ids, paths } = undoRedoState.history[newIndex]

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

  return {
    // Legacy (for compatibility)
    selectedFiles,
    toggleFile,
    selectFiles,
    isFileSelected: (id: number) => selectedFiles.includes(id),
    
    // Path-based (NEW - preferred)
    selectedFilePaths,
    toggleFilePath,
    selectFilePaths,
    isFileSelectedByPath,
    
    // Shared operations
    projectFileMap,
    pathToId,
    idToPath,
    commitSelectionChange,
    undo,
    redo,
    clearSelectedFiles: () => commitSelectionChange([], []),
    canUndo: undoRedoState !== null && undoRedoState.index > 0,
    canRedo: undoRedoState !== null && undoRedoState.index < undoRedoState.history.length - 1,
    
    // Utilities
    removeSelectedFile: (fileId: number) => {
      if (!isInitialized) return
      if (USE_PATH_BASED_SELECTION) {
        const path = idToPath.get(fileId)
        if (path) {
          const newPaths = selectedFilePaths.filter(p => p !== path)
          commitSelectionChange(undefined, newPaths)
        }
      } else {
        commitSelectionChange(selectedFiles.filter(id => id !== fileId))
      }
    }
  }
}
```

## Step 3: Component Updates

### 3.1 File Tree Component
```typescript
// file-tree.tsx
export function FileTree({ file }: { file: FileNode }) {
  const { 
    isFileSelectedByPath, 
    isFileSelected, 
    toggleFilePath, 
    toggleFile 
  } = useSelectedFiles()
  
  // Check selection with path preference
  const isSelected = USE_PATH_BASED_SELECTION 
    ? isFileSelectedByPath(file.path) 
    : isFileSelected(file.id)
  
  const handleClick = () => {
    if (USE_PATH_BASED_SELECTION) {
      toggleFilePath(file.path)
    } else {
      toggleFile(file.id)
    }
  }
  
  return (
    <div 
      className={cn('file-node', { selected: isSelected })}
      onClick={handleClick}
    >
      {file.name}
    </div>
  )
}
```

### 3.2 Selected Files List
```typescript
// selected-files-list.tsx
export function SelectedFilesList() {
  const { 
    selectedFilePaths, 
    selectedFiles, 
    projectFileMap,
    removeSelectedFile 
  } = useSelectedFiles()
  
  // Get files with missing file handling
  const displayFiles = useMemo(() => {
    if (USE_PATH_BASED_SELECTION) {
      return selectedFilePaths
        .map(path => {
          // Find file by path
          for (const [id, file] of projectFileMap) {
            if (file.path === path) return { ...file, id }
          }
          return null
        })
        .filter(Boolean)
    } else {
      return selectedFiles
        .map(id => projectFileMap.get(id))
        .filter(Boolean)
    }
  }, [selectedFilePaths, selectedFiles, projectFileMap])
  
  return (
    <div className="selected-files-list">
      {displayFiles.length === 0 ? (
        <p>No files selected</p>
      ) : (
        <ul>
          {displayFiles.map((file) => (
            <li key={file.path}>
              <span>{file.path}</span>
              <button onClick={() => removeSelectedFile(file.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Show warning for missing files */}
      {USE_PATH_BASED_SELECTION && 
       selectedFilePaths.length > displayFiles.length && (
        <p className="warning">
          {selectedFilePaths.length - displayFiles.length} selected files no longer exist
        </p>
      )}
    </div>
  )
}
```

## Step 4: Migration Strategy

### 4.1 Fresh Start Approach
Since this is a beta application, we're taking a clean break approach:
- New installations will use path-based selection from the start
- Existing users will start fresh with empty selections
- The dual-format support ensures smooth transition

### 4.2 Manual Migration (if needed)
For users who need to preserve selections, they can:
1. Note their selected files before updating
2. Re-select the same files after updating
3. The new path-based system will maintain selections going forward

## Step 5: Service Layer Updates

### 5.1 Add Path-Based Methods to Project Service
```typescript
// project-service.ts
export async function getFilesByPaths(
  projectId: number, 
  paths: string[]
): Promise<ProjectFile[]> {
  if (paths.length === 0) return []
  
  const placeholders = paths.map(() => '?').join(',')
  const query = `
    SELECT * FROM project_files 
    WHERE project_id = ? 
    AND path IN (${placeholders})
  `
  
  const files = await db.query(query).all(projectId, ...paths)
  return files
}

export async function validateFilePaths(
  projectId: number,
  paths: string[]
): Promise<{ valid: string[], invalid: string[] }> {
  const existingFiles = await getFilesByPaths(projectId, paths)
  const existingPaths = new Set(existingFiles.map(f => f.path))
  
  const valid = paths.filter(p => existingPaths.has(p))
  const invalid = paths.filter(p => !existingPaths.has(p))
  
  return { valid, invalid }
}
```

## Step 6: Testing

### 6.1 Unit Tests
```typescript
// use-selected-files.test.ts
describe('useSelectedFiles path-based selection', () => {
  it('should toggle file selection by path', async () => {
    const { result } = renderHook(() => useSelectedFiles())
    
    // Toggle file by path
    act(() => {
      result.current.toggleFilePath('/src/index.ts')
    })
    
    expect(result.current.selectedFilePaths).toContain('/src/index.ts')
    expect(result.current.isFileSelectedByPath('/src/index.ts')).toBe(true)
  })
  
  it('should maintain both IDs and paths in sync', async () => {
    const { result } = renderHook(() => useSelectedFiles())
    
    // Assuming file with ID 123 has path '/src/index.ts'
    act(() => {
      result.current.toggleFile(123)
    })
    
    expect(result.current.selectedFiles).toContain(123)
    expect(result.current.selectedFilePaths).toContain('/src/index.ts')
  })
  
  it('should handle missing files gracefully', async () => {
    const { result } = renderHook(() => useSelectedFiles())
    
    // Select a file that will be deleted
    act(() => {
      result.current.selectFilePaths(['/src/deleted.ts', '/src/exists.ts'])
    })
    
    // After file deletion, only existing file should be in display
    const displayFiles = result.current.selectedFilePaths
      .map(path => result.current.projectFileMap.get(result.current.pathToId.get(path)))
      .filter(Boolean)
    
    expect(displayFiles).toHaveLength(1)
    expect(displayFiles[0].path).toBe('/src/exists.ts')
  })
})
```

## Step 7: Rollout Strategy

### 7.1 Feature Flag Configuration
```typescript
// config/feature-flags.ts
export const FEATURE_FLAGS = {
  USE_PATH_BASED_SELECTION: process.env.USE_PATH_BASED_SELECTION === 'true' || false,
  SHOW_MIGRATION_WARNING: true,
  ENABLE_SELECTION_METRICS: true
}
```

### 7.2 Gradual Rollout
```typescript
// Week 1: Deploy with flag off, run migration in background
// Week 2: Enable for internal users (10%)  
// Week 3: Enable for beta users (50%)
// Week 4: Enable for all users (100%)
// Week 6: Remove ID-based code
```

## Conclusion

This implementation guide provides all the code needed to migrate from ID-based to path-based file selection. The hybrid approach ensures backward compatibility while providing a smooth transition path.