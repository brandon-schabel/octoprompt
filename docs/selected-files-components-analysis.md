# Selected Files Component Analysis

## Overview
This document provides a detailed analysis of all components and services that interact with the selected files feature, identifying specific changes needed for the path-based migration.

## Core Components Requiring Updates

### 1. Hooks Layer

#### use-selected-files.ts
**Current State**: Manages file selection with numeric IDs, undo/redo history
**Changes Needed**:
- Add `selectedFilePaths` array alongside `selectedFiles`
- Create bidirectional Map for ID<->Path conversion
- Update all mutation methods to handle both IDs and paths
- Modify undo/redo history to store both formats
- Add new path-based methods: `toggleFilePath`, `selectFilePaths`, etc.

#### use-kv-local-storage.ts
**Current State**: Stores `selectedFiles` as number array in project tabs
**Changes Needed**:
- Add `selectedFilePaths: string[]` to stored state
- Update type definitions
- Ensure backward compatibility when reading old data

#### use-active-tab-sync.ts
**Current State**: Syncs selected files between tabs using IDs
**Changes Needed**:
- Sync both `selectedFiles` and `selectedFilePaths`
- Handle missing files gracefully

### 2. UI Components

#### file-tree/file-tree.tsx
**Current State**: Uses `isFileSelected(fileId)` for highlighting
**Changes Needed**:
```typescript
// Add path-based selection check
const isSelected = isFileSelectedByPath(file.path) || isFileSelected(file.id)

// Update click handler
const handleFileClick = () => {
  if (USE_PATH_BASED_SELECTION) {
    toggleFilePath(file.path)
  } else {
    toggleFile(file.id)
  }
}
```

#### file-explorer/file-explorer.tsx
**Current State**: Displays selected files by ID
**Changes Needed**:
- Update to show files by path
- Handle cases where file no longer exists
- Update selection callbacks

#### selected-files-list.tsx
**Current State**: Maps over `selectedFiles` IDs
**Changes Needed**:
```typescript
// Update to use paths with fallback
const displayFiles = USE_PATH_BASED_SELECTION 
  ? selectedFilePaths.map(path => projectFileMap.get(pathToIdMap.get(path)))
  : selectedFiles.map(id => projectFileMap.get(id))

// Filter out missing files
const validFiles = displayFiles.filter(Boolean)
```

#### collapsible-selected-files-list.tsx
**Current State**: Shows count and list of selected files by ID
**Changes Needed**:
- Similar updates to selected-files-list.tsx
- Update count to reflect valid files only

#### user-input-panel.tsx
**Current State**: Builds context from selected file IDs
**Changes Needed**:
```typescript
// Update context building
const selectedFileContents = USE_PATH_BASED_SELECTION
  ? await getFilesByPaths(projectId, selectedFilePaths)
  : await getFilesByIds(projectId, selectedFiles)
```

#### suggest-files-dialog.tsx
**Current State**: Returns selected file IDs
**Changes Needed**:
- Add option to return paths instead of IDs
- Update suggestion display to show paths

### 3. Services Layer

#### file-suggestion-strategy-service.ts
**Current State**: Returns file IDs in suggestions
**Changes Needed**:
- Add path information to response
- Option to return paths as primary identifier

#### project-service.ts
**Current State**: File operations use IDs
**Changes Needed**:
- Add `getFilesByPaths` method
- Add path validation utilities
- Ensure path uniqueness per project

#### file-sync-service-unified.ts
**Current State**: Updates files with new IDs
**Changes Needed**:
- Preserve selections when updating files
- Emit events for path changes (renames)

### 4. API Layer

#### active-tab-routes.ts
**Current State**: Updates active tab with file IDs
**Changes Needed**:
- Accept both `selectedFiles` and `selectedFilePaths`
- Validate paths exist in project

#### project-routes.ts
**Current State**: File endpoints use IDs
**Changes Needed**:
- Add path-based file lookup endpoints
- Support both ID and path parameters

### 5. Storage Layer

#### Schemas
**Current State**: Define ID arrays for selections
**Changes Needed**:
- Add path array definitions
- Update validation rules
- Ensure backward compatibility

### 6. MCP Tools

#### consolidated-tools.ts
**Current State**: File operations use IDs
**Changes Needed**:
- Update file suggestion tools to return paths
- Add path validation in tools
- Support both formats in responses

## Component Dependency Graph

```
use-selected-files.ts (Core Hook)
    ├── file-tree.tsx (Selection UI)
    ├── file-explorer.tsx (Display)
    ├── selected-files-list.tsx (List Display)
    ├── user-input-panel.tsx (Context Building)
    ├── suggest-files-dialog.tsx (AI Suggestions)
    └── agent-files-manager.tsx (Agent Integration)

use-kv-local-storage.ts (Persistence)
    ├── use-selected-files.ts
    └── use-active-tab-sync.ts

project-service.ts (Data Layer)
    ├── All UI components
    └── MCP tools

file-sync-service.ts (File Updates)
    └── Triggers selection invalidation
```

## Migration Priority

### Phase 1 - Core (Week 1)
1. Update schemas
2. Modify use-selected-files.ts hook
3. Update use-kv-local-storage.ts

### Phase 2 - UI (Week 2)
1. Update file-tree.tsx
2. Update selected files display components
3. Add missing file handling

### Phase 3 - Services (Week 3)
1. Add path-based methods to services
2. Update file sync to preserve selections
3. Add migration utilities

### Phase 4 - Integration (Week 4)
1. Update MCP tools
2. Test with all features
3. Add monitoring

## Testing Strategy

### Unit Tests
- Path<->ID conversion logic
- Selection persistence across updates
- Missing file handling
- Undo/redo with paths

### Integration Tests
- File rename scenarios
- File deletion handling
- Cross-tab synchronization
- API backward compatibility

### E2E Tests
- Complete user workflows
- Performance with large selections
- Migration scenarios

## Rollback Plan

If issues arise:
1. Feature flag to disable path-based selection
2. Keep ID-based code as fallback
3. Data recovery script to rebuild from IDs
4. Monitoring to detect issues early

## Performance Considerations

### Optimizations Needed
1. **Path Lookup Performance**
   - Use Map instead of array searches
   - Cache path<->ID mappings
   - Index paths in database if needed

2. **Memory Usage**
   - Store paths efficiently
   - Limit selection size
   - Clean up orphaned selections

3. **UI Responsiveness**
   - Debounce selection updates
   - Virtual scrolling for large lists
   - Async validation of paths

## Monitoring & Metrics

### Key Metrics to Track
1. Selection persistence rate
2. Path lookup performance
3. Missing file occurrences
4. User selection patterns
5. Migration success rate

### Logging Points
- Selection changes (ID vs path)
- Conversion failures
- Performance bottlenecks
- User errors

This analysis provides a complete picture of the changes needed across the codebase for successful migration to path-based file selection.