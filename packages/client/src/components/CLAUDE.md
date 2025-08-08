# Component Architecture Guide

This document outlines the component architecture patterns, organization strategy, and development guidelines for the Promptliano client components.

## Component Organization Strategy

The component architecture follows a **feature-based organization** with shared reusable components, organized into clear functional domains:

### Feature-Based Components

- **`assets/`** - Asset generation and documentation management
- **`claude-code/`** - Claude Code integration (agents, commands, sessions)
- **`projects/`** - Core project management functionality
- **`tickets/`** - Ticket and task management system
- **`queues/`** - Queue management and kanban boards
- **`providers/`** - Provider configuration and testing
- **`settings/`** - Application settings and configuration
- **`navigation/`** - App-wide navigation components

### Shared Components

- **Root level** - Shared utilities (markdown, monaco editor, file uploads)
- **`error-boundary/`** - Error handling components
- **`model-selection/`** - Reusable AI model selection system
- **`promptliano/`** - Custom UI primitives

## Key Architecture Patterns

### 1. Tab-with-Sidebar Pattern

Many features use a consistent tab-with-sidebar layout:

```tsx
interface TabWithSidebarProps {
  projectId: number
  projectName?: string
  activeView: string
  onViewChange: (view: string) => void
  className?: string
}

export function FeatureTabWithSidebar({ projectId, activeView, onViewChange }: TabWithSidebarProps) {
  return (
    <div className='flex h-full'>
      {/* Left Sidebar */}
      <div className='w-56 border-r bg-muted/30 flex-shrink-0'>
        <FeatureSidebarNav activeView={activeView} onViewChange={onViewChange} />
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-auto'>
        {activeView === 'view1' && <View1 projectId={projectId} />}
        {activeView === 'view2' && <View2 projectId={projectId} />}
      </div>
    </div>
  )
}
```

**Examples:**

- `claude-code/claude-code-tab-with-sidebar.tsx`
- `assets/assets-tab-with-sidebar.tsx`
- `tickets/tickets-tab-with-sidebar.tsx`

### 2. Views Pattern

Each feature organizes its views in a dedicated `views/` subdirectory with an `index.ts` barrel export:

```tsx
// Feature views structure
feature / views / index.ts // Barrel exports
overview - view.tsx
detail - view.tsx
settings - view.tsx
```

### 3. Error Boundary Integration

Components use layered error boundaries:

```tsx
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { ComponentErrorBoundary } from '@/components/error-boundary/component-error-boundary'

// App-level error boundary
<ErrorBoundary>
  <AppContent />
</ErrorBoundary>

// Component-specific error boundary
<ComponentErrorBoundary componentName="FilePanel">
  <FilePanel />
</ComponentErrorBoundary>
```

### 4. Forward Ref Pattern

Components that need imperative APIs use React.forwardRef:

```tsx
export type ComponentRef = {
  focusSearch: () => void
  focusFileTree: () => void
}

export const Component = forwardRef<ComponentRef, ComponentProps>(function Component({ className }, ref) {
  const searchRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focusSearch: () => searchRef.current?.focus(),
    focusFileTree: () => fileTreeRef.current?.focusTree()
  }))

  return <div>...</div>
})
```

### 5. Compound Component Pattern

Complex components are broken into smaller, composable pieces:

```tsx
// Main component
export function TicketDialog() {
  return (
    <Dialog>
      <TicketDialogHeader />
      <TicketDialogContent />
      <TicketDialogFooter />
    </Dialog>
  )
}

// Compound components
function TicketDialogHeader() {
  /* ... */
}
function TicketDialogContent() {
  /* ... */
}
function TicketDialogFooter() {
  /* ... */
}
```

## Component Development Guidelines

### Creating New Components

#### 1. Determine Component Category

**Feature Component** - Specific to one domain:

```bash
# Place in feature directory
src/components/tickets/ticket-status-badge.tsx
src/components/projects/file-explorer.tsx
```

**Shared Component** - Reusable across features:

```bash
# Place at root or in utility directory
src/components/expandable-textarea.tsx
src/components/model-selection/provider-selector.tsx
```

#### 2. Component Structure Template

```tsx
import React, { forwardRef } from 'react'
import { Button } from '@promptliano/ui'
import { cn } from '@/lib/utils'

interface ComponentProps {
  // Required props
  value: string
  onChange: (value: string) => void

  // Optional props with defaults
  placeholder?: string
  disabled?: boolean
  className?: string

  // Event handlers
  onSubmit?: (data: FormData) => void
  onCancel?: () => void
}

export const Component = forwardRef<HTMLDivElement, ComponentProps>(function Component(
  { value, onChange, placeholder = 'Enter value...', disabled = false, className, onSubmit, onCancel },
  ref
) {
  return (
    <div ref={ref} className={cn('default-styles', className)}>
      {/* Component content */}
    </div>
  )
})
```

#### 3. Props Pattern Guidelines

**Consistent Naming:**

- `className` - Additional CSS classes
- `disabled` - Disable state
- `loading` - Loading state
- `onXxx` - Event handlers
- `xxxId` - Entity identifiers

**Default Values:**

```tsx
// Provide defaults for optional props
placeholder = 'Enter text...'
disabled = false
size = 'md'
```

**Event Handlers:**

```tsx
// Use descriptive names
onSubmit?: (data: FormData) => void
onCancel?: () => void
onSelectionChange?: (selected: string[]) => void
```

### shadcn/ui Integration

Components extensively use shadcn/ui primitives from `@promptliano/ui`:

```tsx
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@promptliano/ui'
```

**Custom Extensions:**

- `promptliano/promptliano-combobox.tsx` - Enhanced combobox
- `promptliano/promptliano-tooltip.tsx` - Consistent tooltips

### State Management Patterns

#### 1. Local State

```tsx
function Component() {
  const [value, setValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  return <div>...</div>
}
```

#### 2. URL State (for navigation)

```tsx
import { useSearch } from '@tanstack/router'

function Component() {
  const { activeView } = useSearch({ from: '/projects' })

  return <div>...</div>
}
```

#### 3. Global State (KV storage)

```tsx
import { useActiveProjectTab } from '@/hooks/use-kv-local-storage'

function Component() {
  const [activeProject] = useActiveProjectTab()
  const projectId = activeProject?.selectedProjectId

  return <div>...</div>
}
```

#### 4. Server State (React Query)

```tsx
import { useGetProject } from '@/hooks/api/use-projects-api'

function Component({ projectId }: { projectId: number }) {
  const { data: project, isLoading, error } = useGetProject(projectId)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return <div>{project?.name}</div>
}
```

### Performance Optimization

#### 1. Lazy Loading

```tsx
import { lazy, Suspense } from 'react'

const LazyMonacoEditor = lazy(() => import('./monaco-editor-wrapper'))

function Component() {
  return (
    <Suspense fallback={<div>Loading editor...</div>}>
      <LazyMonacoEditor />
    </Suspense>
  )
}
```

#### 2. Memoization

```tsx
import { useMemo, useCallback } from 'react'

function Component({ items, filter }) {
  const filteredItems = useMemo(() => items.filter((item) => item.name.includes(filter)), [items, filter])

  const handleClick = useCallback((id: string) => {
    // Handle click
  }, [])

  return <div>...</div>
}
```

### Accessibility Patterns

```tsx
function Component() {
  return (
    <div>
      {/* Proper labeling */}
      <label htmlFor='input-id'>Label</label>
      <input id='input-id' aria-describedby='help-text' />
      <div id='help-text'>Helper text</div>

      {/* Keyboard navigation */}
      <div
        role='button'
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleAction()
          }
        }}
      >
        Custom button
      </div>

      {/* Screen reader support */}
      <div aria-live='polite' aria-atomic='true'>
        {status && <span>{status}</span>}
      </div>
    </div>
  )
}
```

### Testing Strategy

#### 1. Component Tests

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Component } from './component'

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component value='test' onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('test')).toBeInTheDocument()
  })

  it('calls onChange when value changes', () => {
    const onChange = vi.fn()
    render(<Component value='' onChange={onChange} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'new value' }
    })

    expect(onChange).toHaveBeenCalledWith('new value')
  })
})
```

#### 2. Hook Tests

```tsx
import { renderHook, act } from '@testing-library/react'
import { useModelSelection } from './use-model-selection'

describe('useModelSelection', () => {
  it('updates provider', () => {
    const { result } = renderHook(() => useModelSelection())

    act(() => {
      result.current.setProvider('openai')
    })

    expect(result.current.provider).toBe('openai')
  })
})
```

## Best Practices

### 1. Component Composition

- Prefer composition over inheritance
- Use compound components for complex UI
- Keep components focused on single responsibility

### 2. Props Design

- Use TypeScript interfaces for props
- Provide sensible defaults
- Use union types for controlled options

### 3. Error Handling

- Wrap components in error boundaries
- Provide fallback UI for error states
- Log errors for debugging

### 4. Performance

- Use React.memo for expensive renders
- Optimize re-renders with useCallback/useMemo
- Lazy load heavy components

### 5. Accessibility

- Include proper ARIA attributes
- Support keyboard navigation
- Provide screen reader announcements

### 6. Styling

- Use Tailwind CSS classes
- Follow consistent spacing/sizing scale
- Support dark/light theme variants

## File Organization Examples

### Feature Component Structure

```
tickets/
  views/
    ticket-list-view.tsx
    ticket-detail-view.tsx
    index.ts
  utils/
    ticket-utils.ts
  ticket-dialog.tsx
  ticket-list.tsx
  tickets-tab-with-sidebar.tsx
  tickets-sidebar-nav.tsx
```

### Shared Component Structure

```
model-selection/
  index.ts                      # Barrel exports
  README.md                     # Documentation
  use-model-selection.tsx       # Hook
  provider-model-selector.tsx   # Main component
  model-settings-popover.tsx    # Advanced component
  example-usage.tsx             # Usage examples
```

This architecture ensures components are maintainable, testable, and follow consistent patterns across the application.
