# Selected Files Path-Based Migration Plan

## Executive Summary

The current selected files feature uses numeric file IDs to track selections. When files are updated, their IDs change, breaking the selection. This migration plan outlines a comprehensive approach to convert from ID-based to path-based file selection, ensuring selections persist across file updates.

## Problem Analysis

### Current Issues
1. **ID Instability**: File IDs change when files are updated (new timestamp-based IDs)
2. **Broken Selections**: Users lose their file selections after any file modification
3. **Poor UX**: Users must re-select files repeatedly during development
4. **State Inconsistency**: Selected file IDs may reference non-existent files

### Root Cause
- Files use timestamp-based IDs (`id INTEGER PRIMARY KEY`)
- IDs are regenerated on updates, not preserved
- Selection system tracks by these unstable IDs
- No fallback mechanism when IDs become invalid

## Solution Design

### Path-Based Identification
Use file paths as the stable identifier for selections, with the following approach:

1. **Primary Key**: Use `(projectId, path)` as the natural key
2. **Storage Format**: Store paths instead of IDs in selection arrays
3. **Validation**: Validate paths exist before operations
4. **Performance**: Use Maps for O(1) lookups

### Hybrid Approach (Recommended)
Maintain both systems during transition:
- Store both `selectedFileIds` and `selectedFilePaths`
- Prefer paths, fall back to IDs
- Gradually phase out ID-based selection

## Migration Strategy

### Phase 1: Schema Updates

#### 1.1 Update Schemas
```typescript
// selected-files.schemas.ts
export const selectedFilesDataSchema = z.object({
  projectId: idSchemaSpec,
  tabId: z.number().optional(),
  fileIds: idArraySchemaSpec.default([]), // Keep for backward compatibility
  filePaths: z.array(z.string()).default([]), // NEW: Path-based selection
  promptIds: idArraySchemaSpec.default([]),
  userPrompt: z.string().default(''),
  updatedAt: unixTSSchemaSpec
})

// global-state-schema.ts
export const projectTabStateSchema = z.object({
  // ... existing fields ...
  selectedFiles: idArraySchemaSpec.default([]), // Keep for compatibility
  selectedFilePaths: z.array(z.string()).default([]), // NEW
  // ... rest of schema ...
})

// active-tab.schemas.ts
export const activeTabDataSchema = z.object({
  // ... existing fields ...
  tabMetadata: z.object({
    selectedFiles: z.array(z.number()).optional(), // Keep
    selectedFilePaths: z.array(z.string()).optional(), // NEW
    // ... rest ...
  }).optional()
})
```

### Phase 2: Hook Updates

#### 2.1 Update use-selected-files.ts
```typescript
// Add path-based operations alongside ID-based
export function useSelectedFiles({ tabId = null }: { tabId?: number | null } = {}) {
  // ... existing code ...
  
  // NEW: Track selected paths
  const selectedFilePaths: string[] = undoRedoState?.history[undoRedoState.index]?.paths ?? []
  
  // NEW: Convert between IDs and paths
  const pathToId = new Map<string, number>()
  const idToPath = new Map<number, string>()
  
  // Build bidirectional maps
  for (const [id, file] of projectFileMap) {
    pathToId.set(file.path, id)
    idToPath.set(id, file.path)
  }
  
  // NEW: Path-based operations
  const toggleFilePath = (path: string) => {
    if (!isInitialized) return
    const newPaths = selectedFilePaths.includes(path) 
      ? selectedFilePaths.filter(p => p !== path)
      : [...selectedFilePaths, path]
    commitSelectionChange(null, newPaths)
  }
  
  // Update commit function to handle both
  const commitSelectionChange = (newIds: number[] | null, newPaths: string[] | null) => {
    // If only IDs provided, convert to paths
    if (newIds && !newPaths) {
      newPaths = newIds.map(id => idToPath.get(id)).filter(Boolean) as string[]
    }
    // If only paths provided, convert to IDs for compatibility
    if (newPaths && !newIds) {
      newIds = newPaths.map(path => pathToId.get(path)).filter(Boolean) as number[]
    }
    
    // Update both in storage
    updateActiveProjectTab({
      selectedFiles: newIds ?? [],
      selectedFilePaths: newPaths ?? []
    })
    
    // Update history with both
    updateUndoRedoState({
      history: [...history, { ids: newIds ?? [], paths: newPaths ?? [] }],
      index: newIndex
    })
  }
  
  return {
    // Existing returns
    selectedFiles,
    selectedFilePaths, // NEW
    toggleFilePath, // NEW
    isFileSelectedByPath: (path: string) => selectedFilePaths.includes(path), // NEW
    // ... rest of returns
  }
}
```

### Phase 3: Component Updates

#### 3.1 File Selection Components
- `file-tree.tsx` - Update to use paths for selection
- `file-explorer.tsx` - Convert file clicks to use paths
- `selected-files-list.tsx` - Display using paths, handle missing files
- `collapsible-selected-files-list.tsx` - Same updates

#### 3.2 Context Building
- `user-input-panel.tsx` - Update to resolve paths to file content
- `suggest-files-dialog.tsx` - Return paths instead of IDs
- `agent-files-manager.tsx` - Work with paths

### Phase 4: Service Updates

#### 4.1 File Services
- Add path validation methods
- Update file suggestion to return paths
- Ensure file sync preserves paths

#### 4.2 API Updates
- Update endpoints to accept both IDs and paths
- Add path validation middleware
- Ensure backward compatibility

### Phase 5: Migration Implementation

#### 5.1 Data Migration Script
```typescript
// scripts/migrate-selected-files-to-paths.ts
async function migrateSelectedFilesToPaths() {
  // 1. Get all project tabs with selected files
  const tabs = await getProjectTabs()
  
  for (const tab of tabs) {
    if (tab.selectedFiles?.length > 0) {
      // 2. Convert IDs to paths
      const files = await getFilesByIds(tab.projectId, tab.selectedFiles)
      const paths = files.map(f => f.path)
      
      // 3. Update tab with paths
      await updateProjectTab(tab.id, {
        selectedFilePaths: paths
      })
    }
  }
  
  // 4. Migrate active tab data
  const activeTabs = await getActiveTabs()
  for (const activeTab of activeTabs) {
    if (activeTab.tabMetadata?.selectedFiles?.length > 0) {
      const files = await getFilesByIds(
        activeTab.projectId, 
        activeTab.tabMetadata.selectedFiles
      )
      const paths = files.map(f => f.path)
      
      await updateActiveTab(activeTab.id, {
        tabMetadata: {
          ...activeTab.tabMetadata,
          selectedFilePaths: paths
        }
      })
    }
  }
}
```

### Phase 6: Rollout Plan

#### 6.1 Feature Flags
```typescript
const USE_PATH_BASED_SELECTION = true // Toggle for gradual rollout
```

#### 6.2 Compatibility Layer
- Read both IDs and paths
- Write to both fields
- Prefer paths when available
- Fall back to IDs if paths missing

#### 6.3 Deprecation Timeline
1. **Week 1-2**: Deploy hybrid system
2. **Week 3-4**: Monitor for issues
3. **Week 5-6**: Stop writing to ID fields
4. **Week 7-8**: Remove ID-based code

## Implementation Checklist

### Database & Schema
- [ ] Update `selected-files.schemas.ts` with `filePaths` field
- [ ] Update `global-state-schema.ts` with `selectedFilePaths`
- [ ] Update `active-tab.schemas.ts` with path support
- [ ] Create migration script for existing data
- [ ] Add indexes for path lookups if needed

### React Hooks
- [ ] Update `use-selected-files.ts` with path operations
- [ ] Add path<->ID conversion utilities
- [ ] Update undo/redo to track paths
- [ ] Add path validation before operations
- [ ] Ensure backward compatibility

### UI Components
- [ ] Update `file-tree.tsx` to use paths
- [ ] Update `file-explorer.tsx` selection logic
- [ ] Update `selected-files-list.tsx` display
- [ ] Update `collapsible-selected-files-list.tsx`
- [ ] Handle missing files gracefully
- [ ] Update file click handlers

### Services & API
- [ ] Update file suggestion services
- [ ] Add path validation endpoints
- [ ] Update MCP tools for paths
- [ ] Ensure API backward compatibility
- [ ] Update file sync to preserve paths

### Testing
- [ ] Unit tests for path operations
- [ ] Integration tests for selection
- [ ] Test migration script
- [ ] Test backward compatibility
- [ ] Performance tests with many files

### Documentation
- [ ] Update API documentation
- [ ] Update component docs
- [ ] Add migration guide
- [ ] Update troubleshooting

## Risk Mitigation

### Potential Issues
1. **Performance**: Path lookups might be slower
   - **Mitigation**: Use Map data structures, add DB indexes

2. **File Renames**: Paths change when files renamed
   - **Mitigation**: Hook into file rename events, update selections

3. **Case Sensitivity**: Path comparison issues
   - **Mitigation**: Normalize paths, use consistent comparison

4. **Backward Compatibility**: Existing integrations break
   - **Mitigation**: Maintain both systems temporarily

## Success Metrics

1. **Zero Lost Selections**: File updates don't break selections
2. **Performance**: Selection operations remain fast (<100ms)
3. **Compatibility**: Existing features continue working
4. **User Satisfaction**: Reduced complaints about lost selections

## Alternative Approaches Considered

1. **Stable IDs**: Keep same ID on updates
   - **Rejected**: Would require major DB schema changes

2. **UUID-based IDs**: Use UUIDs instead of timestamps
   - **Rejected**: Doesn't solve update problem

3. **Checksum-based**: Track by file content hash
   - **Rejected**: Too complex, changes with edits

4. **Hybrid with Auto-Recovery**: Try ID first, fall back to path
   - **Considered**: Good for transition period

## Conclusion

Path-based file selection provides a stable, intuitive way to track selected files that persists across updates. The hybrid approach allows for a smooth transition while maintaining backward compatibility. With careful implementation and testing, this migration will significantly improve the user experience.