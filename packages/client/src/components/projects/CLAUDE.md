# Projects UI Component Architecture

This directory contains the comprehensive project management interface for Promptliano, providing file management, git integration, analytics, and project configuration capabilities.

## Architecture Overview

### Component Hierarchy

```
projects/
├── Core Layout Components
│   ├── project-list.tsx                 # Project list/grid view with CRUD operations
│   ├── project-switcher.tsx            # Quick project switching dropdown
│   ├── project-navigation-menu.tsx     # Main navigation menu bar
│   └── empty-project-tabs-view.tsx     # Empty state for project tabs
│
├── File Management System
│   ├── file-panel/                     # Main file management container
│   │   ├── file-panel.tsx             # Root file panel with keyboard shortcuts
│   │   ├── project-header.tsx         # Project info header
│   │   ├── file-explorer/             # File browsing and search
│   │   │   ├── file-explorer.tsx      # Main explorer with search & autocomplete
│   │   │   ├── selected-files-list-display.tsx
│   │   │   ├── tabbed-sidebar-panel.tsx
│   │   │   ├── empty-project-screen.tsx
│   │   │   └── no-results-screen.tsx
│   │   └── file-tree/                 # Tree view components
│   │       └── file-tree.tsx          # Hierarchical file tree
│   ├── selected-files-list.tsx        # Selected files management
│   ├── collapsible-selected-files-list.tsx
│   └── directory-browser-dialog.tsx   # Directory selection dialog
│
├── Git Integration
│   ├── git-tab-with-sidebar.tsx       # Git main view with sidebar
│   ├── git-sidebar-nav.tsx            # Git navigation sidebar
│   ├── git-tab-view.tsx               # Git changes view
│   ├── git-operations-panel.tsx       # Git action buttons
│   ├── git-diff-dialog.tsx            # Diff viewer dialog
│   ├── git-branches-view.tsx          # Branch management
│   ├── git-stash-view.tsx             # Stash management
│   ├── git-worktree-view.tsx          # Worktree management
│   └── git-commit-history/            # Commit history components
│       ├── commit-list.tsx            # Commit timeline
│       ├── commit-card.tsx            # Individual commit display
│       ├── commit-detail-modal.tsx    # Commit detail view
│       ├── branch-selector.tsx        # Branch selection
│       └── branch-selector-searchable.tsx
│
├── Analytics & Statistics
│   ├── project-stats-display-enhanced-v2.tsx  # Enhanced statistics view
│   ├── project-stats-display.tsx             # Basic statistics
│   ├── statistics-view.tsx                   # Statistics dashboard
│   ├── mcp-analytics-tab-view.tsx            # MCP analytics tab
│   ├── mcp-analytics-view.tsx               # MCP analytics dashboard
│   └── mcp-analytics/                        # MCP analytics components
│       ├── mcp-executions-table.tsx         # MCP execution history
│       └── mcp-executions-columns.tsx       # Table column definitions
│
├── Project Configuration
│   ├── manage-tab-with-sidebar.tsx     # Management view with sidebar
│   ├── manage-sidebar-nav.tsx          # Management navigation
│   ├── project-settings-dialog.tsx     # Project settings modal
│   ├── project-settings-tab.tsx        # Settings tab content
│   ├── project-settings-view.tsx       # Settings main view
│   └── manage-views/                   # Management view exports
│
├── MCP Integration
│   ├── mcp-batch-installer.tsx         # Bulk MCP installation
│   ├── mcp-config-link.tsx             # MCP configuration links
│   ├── mcp-project-config-editor.tsx   # Project MCP config
│   ├── mcp-status-indicator.tsx        # MCP status display
│   └── mcp-troubleshooting.tsx         # MCP debugging tools
│
├── Prompts & Content
│   ├── prompts-list.tsx                # Project prompts management
│   ├── prompt-dialog.tsx               # Prompt creation/editing
│   ├── prompt-overview-panel.tsx       # Prompts overview
│   ├── summarization-view.tsx          # File summarization
│   ├── summarization-stats-card.tsx    # Summarization metrics
│   ├── summary-dialog.tsx              # Summary creation
│   └── summary-options-dialog.tsx      # Summary options
│
└── Utilities
    ├── project-assets-view.tsx          # Project assets management
    ├── project-branch-info.tsx          # Branch information display
    ├── project-dialog.tsx               # Project creation/editing
    ├── agent-files-manager.tsx          # Agent file management
    └── user-input-panel.tsx             # User input interface
```

## Key Patterns & Architecture

### 1. State Management Strategy

**Global State (KV Storage)**

- Active project tabs and selection state
- File selection history with undo/redo
- UI preferences and settings
- Recent projects tracking

**React Query Integration**

- Server state management for projects, files, git data
- Optimistic updates with rollback
- Intelligent caching and invalidation

### 2. File Management Architecture

**File Panel Structure**

```typescript
FilePanel (Root Container)
├── Project Header (project info, branch status)
├── File Explorer (search, autocomplete, file tree)
│   ├── Search Input (with keyboard shortcuts)
│   ├── File Tree (hierarchical navigation)
│   └── Autocomplete Suggestions
└── Selected Files List (management, preview, editing)
```

**File Selection System**

- Path-based file tracking (migrated from ID-based)
- Undo/redo functionality for file selection
- Keyboard shortcuts for quick navigation
- Bookmark groups for common file sets

### 3. Git Integration Patterns

**Sidebar Navigation Pattern**

```typescript
GitTabWithSidebar
├── GitSidebarNav (navigation menu)
└── Content Area (view-specific components)
    ├── GitTabView (changes)
    ├── CommitList (history)
    ├── GitBranchesView (branch management)
    ├── GitStashView (stash management)
    └── GitWorktreeView (worktree management)
```

**Git State Management**

- Real-time status updates
- Optimistic mutations for git operations
- Error handling with rollback capabilities
- Integration with file selection system

### 4. Analytics Architecture

**Metric Card Pattern**

```typescript
interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: { value: number; isPositive: boolean }
  gradient?: string
}
```

**Dashboard Composition**

- Modular metric cards with gradients
- Progress bars for categorical data
- Integration with queue system overview
- Real-time data updates

## Component Patterns

### 1. Keyboard Navigation Pattern

**Universal Navigation System**

```typescript
// Standard keyboard shortcuts across components
useHotkeys('mod+f', () => searchInputRef.current?.focus()) // Focus search
useHotkeys('mod+g', () => fileTreeRef.current?.focusTree()) // Focus file tree
useHotkeys('mod+z', () => undo()) // Undo operation
useHotkeys('shift+mod+z', () => redo()) // Redo operation

// Arrow key navigation
useHotkeys('up/down', () => navigateList()) // Navigate suggestions
useHotkeys('left/right', () => navigateColumns()) // Navigate panels
useHotkeys('enter/space', () => selectItem()) // Select item
```

### 2. Search and Autocomplete Pattern

**Enhanced Search Experience**

```typescript
const FileExplorer = () => {
  const [localFileSearch, setLocalFileSearch] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteIndex, setAutocompleteIndex] = useState(-1)

  // Debounced search with instant local filtering
  const debouncedSetFileSearch = useDebounce(setLocalFileSearch, 300)

  // Keyboard navigation in autocomplete
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        setAutocompleteIndex((prev) => Math.min(suggestions.length - 1, prev + 1))
      case 'ArrowUp':
        setAutocompleteIndex((prev) => Math.max(0, prev - 1))
      case 'Enter':
        selectHighlightedFile()
      case 'ArrowRight':
        previewFile()
    }
  }
}
```

### 3. File Selection Management

**Undo/Redo File Selection**

```typescript
const useSelectedFiles = () => {
  const [history, setHistory] = useState<number[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const undo = () => {
    if (canUndo) {
      setHistoryIndex((prev) => prev - 1)
      const previousSelection = history[historyIndex - 1]
      setSelectedFiles(previousSelection)
    }
  }

  const redo = () => {
    if (canRedo) {
      setHistoryIndex((prev) => prev + 1)
      const nextSelection = history[historyIndex + 1]
      setSelectedFiles(nextSelection)
    }
  }
}
```

### 4. Git Integration Pattern

**Unified Git Operations**

```typescript
const GitOperationsPanel = () => {
  const pullMutation = useMutation({
    mutationFn: () => promptlianoClient.git.pull(projectId),
    onSuccess: () => {
      toast.success('Successfully pulled from remote')
      queryClient.invalidateQueries(['git-status', projectId])
    },
    onError: (error) => toast.error(`Failed to pull: ${error.message}`)
  })

  const pushMutation = useMutation({
    mutationFn: () => promptlianoClient.git.push(projectId),
    onSuccess: () => {
      toast.success('Successfully pushed to remote')
      queryClient.invalidateQueries(['git-status', projectId])
    }
  })
}
```

## Testing Patterns

### 1. Component Testing Strategy

**File Management Components**

```typescript
// Test file selection functionality
describe('FileExplorer', () => {
  it('should handle keyboard navigation in search', () => {
    render(<FileExplorer />)
    const searchInput = screen.getByPlaceholderText(/search file/i)

    fireEvent.keyDown(searchInput, { key: 'ArrowDown' })
    expect(autocomplete).toHaveFocus()
  })

  it('should support file selection with Enter/Space', () => {
    render(<FileExplorer />)
    // Test file selection logic
  })
})
```

**Git Integration Testing**

```typescript
describe('GitTabView', () => {
  it('should handle git operations with proper error handling', async () => {
    const mockPull = jest.fn().mockRejectedValue(new Error('Network error'))
    render(<GitTabView />)

    fireEvent.click(screen.getByText('Pull'))
    await waitFor(() => {
      expect(screen.getByText(/failed to pull/i)).toBeInTheDocument()
    })
  })
})
```

### 2. Integration Testing

**File Tree Navigation**

```typescript
describe('File Tree Integration', () => {
  it('should navigate between file tree and selected files', () => {
    render(<FilePanel />)

    // Test keyboard navigation between panels
    fireEvent.keyDown(fileTree, { key: 'ArrowRight' })
    expect(selectedFilesList).toHaveFocus()
  })
})
```

## Performance Optimizations

### 1. Virtual Scrolling for Large File Lists

```typescript
const FileTree = memo(({ files }) => {
  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 35,
  })

  return (
    <div ref={scrollElementRef}>
      {virtualizer.getVirtualItems().map(virtualItem => (
        <FileTreeItem
          key={virtualItem.key}
          file={files[virtualItem.index]}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItem.start}px)`,
          }}
        />
      ))}
    </div>
  )
})
```

### 2. Debounced Search with Memoization

```typescript
const useFileSearch = (files: ProjectFile[], searchTerm: string) => {
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  return useMemo(() => {
    if (!debouncedSearchTerm) return files

    return files.filter(
      (file) =>
        file.path.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        file.content?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
  }, [files, debouncedSearchTerm])
}
```

## Accessibility Features

### 1. Keyboard Navigation

- **Tab navigation**: Logical tab order through all interactive elements
- **Arrow key navigation**: Within lists, trees, and autocomplete
- **Escape key**: Consistent close/cancel behavior
- **Enter/Space**: Consistent selection behavior

### 2. Screen Reader Support

```typescript
// Proper ARIA labels and descriptions
<Button
  aria-label={`Remove file ${file.name} from selection`}
  aria-describedby={`file-${file.id}-description`}
>
  <X className="h-4 w-4" />
</Button>

<div id={`file-${file.id}-description`} className="sr-only">
  File size: {formatBytes(file.size)}, Last modified: {formatDate(file.modifiedAt)}
</div>
```

### 3. Focus Management

```typescript
const useFocusManagement = () => {
  const focusableElements = useRef<HTMLElement[]>([])
  const [focusIndex, setFocusIndex] = useState(0)

  const focusNext = () => {
    const nextIndex = (focusIndex + 1) % focusableElements.current.length
    focusableElements.current[nextIndex]?.focus()
    setFocusIndex(nextIndex)
  }

  const focusPrevious = () => {
    const prevIndex = focusIndex === 0 ? focusableElements.current.length - 1 : focusIndex - 1
    focusableElements.current[prevIndex]?.focus()
    setFocusIndex(prevIndex)
  }
}
```

## Code Examples

### 1. Creating a New Project View Component

```typescript
import React from 'react'
import { useGetProject } from '@/hooks/api/use-projects-api'
import { Card, CardContent, CardHeader, CardTitle } from '@promptliano/ui'
import { useActiveProjectTab } from '@/hooks/use-kv-local-storage'

export function MyProjectView() {
  const [activeProjectTabState] = useActiveProjectTab()
  const projectId = activeProjectTabState?.selectedProjectId

  const { data: projectData, isLoading, error } = useGetProject(projectId ?? -1)

  if (isLoading) {
    return <div>Loading project data...</div>
  }

  if (error) {
    return <div>Error loading project: {error.message}</div>
  }

  if (!projectData?.data) {
    return <div>No project selected</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Custom Project View</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Project: {projectData.data.name}</p>
        <p>Path: {projectData.data.path}</p>
      </CardContent>
    </Card>
  )
}
```

### 2. Integrating with File Selection System

```typescript
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { useProjectFileMap } from '@/hooks/utility-hooks/use-selected-files'

export function MyFileComponent() {
  const { selectedFiles, selectFiles, clearSelectedFiles } = useSelectedFiles()
  const projectFileMap = useProjectFileMap()

  const handleAddFile = (fileId: number) => {
    selectFiles(prev => [...prev, fileId])
  }

  const handleRemoveFile = (fileId: number) => {
    selectFiles(prev => prev.filter(id => id !== fileId))
  }

  return (
    <div>
      <h3>Selected Files: {selectedFiles.length}</h3>
      {selectedFiles.map(fileId => {
        const file = projectFileMap.get(fileId)
        return file ? (
          <div key={fileId}>
            {file.name} - {file.path}
            <button onClick={() => handleRemoveFile(fileId)}>Remove</button>
          </div>
        ) : null
      })}
    </div>
  )
}
```

### 3. Adding Git Integration

```typescript
import { useProjectGitStatus } from '@/hooks/api/use-git-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { promptlianoClient } from '@/hooks/promptliano-client'

export function MyGitComponent({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const { data: gitStatus } = useProjectGitStatus(projectId)

  const commitMutation = useMutation({
    mutationFn: (message: string) =>
      promptlianoClient.git.commit(projectId, message),
    onSuccess: () => {
      queryClient.invalidateQueries(['git-status', projectId])
      toast.success('Commit successful')
    },
    onError: (error) => {
      toast.error(`Commit failed: ${error.message}`)
    }
  })

  const handleCommit = (message: string) => {
    if (message.trim()) {
      commitMutation.mutate(message.trim())
    }
  }

  return (
    <div>
      <h3>Git Status</h3>
      {gitStatus?.success && (
        <div>
          <p>Branch: {gitStatus.data.currentBranch}</p>
          <p>Changed files: {gitStatus.data.files.length}</p>
          <button onClick={() => handleCommit('My commit message')}>
            Commit Changes
          </button>
        </div>
      )}
    </div>
  )
}
```

## Best Practices

### 1. Component Design

- Use compound components for complex UI patterns
- Implement proper keyboard navigation
- Include loading and error states
- Follow accessibility guidelines

### 2. State Management

- Use React Query for server state
- Keep local state minimal and focused
- Implement optimistic updates where appropriate
- Handle errors gracefully with user feedback

### 3. Performance

- Memoize expensive computations
- Use virtual scrolling for large lists
- Debounce user input
- Implement proper cleanup in useEffect

### 4. Testing

- Test keyboard navigation
- Mock API calls appropriately
- Test error states and edge cases
- Include accessibility testing

This architecture provides a robust, scalable foundation for project management functionality with excellent user experience, performance, and maintainability.
