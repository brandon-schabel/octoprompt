# CLAUDE.md - Client Package

You are an expert React/TypeScript frontend developer working in the Promptliano client package. This package is a modern React web application built with TanStack Router, TanStack Query, and shadcn/ui components.

## Architecture Overview

### Core Stack

- **React 19** with TypeScript
- **TanStack Router** for file-based routing with type-safe search params
- **TanStack Query** for server state management
- **shadcn/ui** + Radix UI for component library
- **Tailwind CSS** for styling
- **Zod** for runtime type validation
- **react-hook-form** for form management

### Project Structure

```
packages/client/
├── src/
│   ├── components/          # React components (feature-based organization)
│   ├── hooks/              # Custom React hooks
│   │   ├── api/            # API-specific hooks
│   │   └── utility-hooks/  # Utility hooks
│   ├── lib/                # Utilities and configurations
│   ├── routes/             # File-based routing (TanStack Router)
│   ├── constants/          # Application constants
│   ├── services/           # Business logic and external services
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
└── public/                 # Static assets
```

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze implementation quality and suggest improvements
   - Ensure React best practices, performance optimizations, and accessibility

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on component composition and reusability

3. **Package-Specific Agents**
   - Use `promptliano-ui-architect` for React component development
   - Use `tanstack-router-expert` for routing implementation
   - Use `zod-schema-architect` for form validation schemas
   - Use `vercel-ai-sdk-expert` for AI chat integration features

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about what was implemented/changed
- Use multiple agents concurrently for maximum efficiency
- Include screenshots or component descriptions for UI work

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Define data structure (source of truth)
2. **Storage layer** - Create tables with validation
3. **Services** - Implement business logic
4. **MCP tools** - Enable AI access
5. **API routes** - Create endpoints with OpenAPI
6. **API client** - Add to single api-client.ts file
7. **React hooks** - Setup with TanStack Query (this package)
8. **UI components** - Build with shadcn/ui (this package)
9. **Page integration** - Wire everything together (this package)
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package handles steps 7-9: Creating React hooks with TanStack Query, building UI components with shadcn/ui, and integrating everything into pages with TanStack Router.

See main `/CLAUDE.md` for complete flow documentation.

## Component Organization Patterns

### Feature-Based Component Structure

Components are organized by feature/domain rather than by type:

```typescript
components/
├── projects/           # Project management components
│   ├── file-panel/
│   ├── git-commit-history/
│   └── project-dialog.tsx
├── navigation/         # App navigation components
├── error-boundary/     # Error handling components
├── assets/            # Asset generation features
├── claude-code/       # Claude Code integration
└── shared/            # Truly shared/generic components
```

### Component Creation Patterns

#### 1. Feature Components with Error Boundaries

```typescript
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'

export function MyFeatureComponent() {
  return (
    <ErrorBoundary>
      {/* Component content */}
    </ErrorBoundary>
  )
}
```

#### 2. Ref-Forwarding Components with Imperative APIs

```typescript
export type FilePanelRef = {
  focusSearch: () => void
  focusFileTree: () => void
  focusPrompts: () => void
}

export const FilePanel = forwardRef<FilePanelRef, FilePanelProps>(
  function FilePanel({ className }, ref) {
    const searchInputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focusSearch: () => searchInputRef.current?.focus(),
      focusFileTree: () => {/* implementation */},
      focusPrompts: () => {/* implementation */}
    }))

    return (
      <div className={className}>
        {/* Component JSX */}
      </div>
    )
  }
)
```

#### 3. Tab-Based Components with Sidebar Navigation

```typescript
export function FeatureTabWithSidebar({
  featureView,
  onFeatureViewChange
}: {
  featureView?: string
  onFeatureViewChange: (view: string) => void
}) {
  return (
    <div className="flex h-full">
      <div className="w-64 border-r">
        <FeatureSidebarNav
          activeView={featureView}
          onViewChange={onFeatureViewChange}
        />
      </div>
      <div className="flex-1">
        <Tabs value={featureView || 'default'}>
          <TabsContent value="view1">
            <FeatureView1 />
          </TabsContent>
          <TabsContent value="view2">
            <FeatureView2 />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

## TanStack Router Patterns

### File-Based Routing Structure

```
routes/
├── __root.tsx          # Root layout with providers
├── index.tsx           # Home route
├── projects.tsx        # Main projects route
├── chat.tsx            # Chat interface
├── settings.tsx        # App settings
└── providers.tsx       # Provider management
```

### Route Definition Pattern

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { projectsSearchSchema } from '@/lib/search-schemas'

export const Route = createFileRoute('/projects')({
  validateSearch: zodValidator(projectsSearchSchema),
  beforeLoad: async ({ context, search }) => {
    // Prefetch data based on search params
    const { queryClient, promptlianoClient } = context

    await queryClient.prefetchQuery({
      queryKey: ['projects'],
      queryFn: () => promptlianoClient.projects.listProjects()
    })
  },
  component: ProjectsPage
})
```

### Search Schema Validation

All URL search parameters must be validated with Zod schemas in `/lib/search-schemas.ts`:

```typescript
// Define the search schema
export const projectsSearchSchema = z.object({
  projectId: z.coerce.number().optional().catch(undefined),
  activeView: z.enum(['context', 'flow', 'git', 'manage']).catch('context').optional(),
  tab: z.string().catch('').optional()
})

// Use in component
export function ProjectsPage() {
  const search = Route.useSearch() // Type-safe based on schema
  const navigate = useNavigate()

  const handleViewChange = (view: string) => {
    navigate({
      to: '/projects',
      search: (prev) => ({ ...prev, activeView: view }),
      replace: true
    })
  }
}
```

## State Management Patterns

### Local Storage with KV System

The app uses a sophisticated key-value local storage system:

```typescript
import { useGetKvValue, useSetKvValue } from '@/hooks/use-kv-local-storage'

export function useProjectSettings() {
  const [settings, setSettings] = useGetKvValue('appSettings')

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return { settings, updateSetting }
}
```

### Project Tab Management

Complex tab state management with local storage persistence:

```typescript
const [activeProjectTabState] = useActiveProjectTab()
const updateActiveProjectTab = useUpdateActiveProjectTab()
const { createProjectTab } = useCreateProjectTab()

// Create new tab
const newTabId = createProjectTab({
  displayName: 'New Tab',
  selectedProjectId: 123,
  selectedFiles: [],
  selectedPrompts: []
})

// Update existing tab
updateActiveProjectTab((prev) => ({
  ...prev,
  selectedFiles: [...prev.selectedFiles, newFileId]
}))
```

## Data Fetching Patterns

### API Hooks Architecture

All API interactions use TanStack Query through custom hooks:

```typescript
// packages/client/src/hooks/api-hooks.ts - Centralized API hooks
export function useGetProjects() {
  return useQuery({
    queryKey: ['projects', 'list'],
    queryFn: () => promptlianoClient.projects.listProjects(),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export function useCreateProject() {
  const { invalidateAllProjects } = useInvalidateProjects()

  return useMutation({
    mutationFn: (data: CreateProjectBody) => promptlianoClient.projects.createProject(data),
    onSuccess: () => {
      invalidateAllProjects()
      toast.success('Project created successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create project')
    }
  })
}
```

### Query Key Patterns

```typescript
const PROJECT_KEYS = {
  all: ['projects'] as const,
  list: () => [...PROJECT_KEYS.all, 'list'] as const,
  detail: (projectId: number) => [...PROJECT_KEYS.all, 'detail', projectId] as const,
  files: (projectId: number) => [...PROJECT_KEYS.all, 'files', projectId] as const
}
```

### Cache Invalidation Patterns

```typescript
export function useInvalidateProjects() {
  const queryClient = useQueryClient()

  return {
    invalidateAllProjects: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all })
    },
    invalidateProject: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
    },
    setProjectDetail: (project: Project) => {
      queryClient.setQueryData(PROJECT_KEYS.detail(project.id), project)
    }
  }
}
```

## Form Handling Patterns

### Zod + react-hook-form Integration

```typescript
import useZodForm from '@/hooks/use-zod-hook-form'
import { createProjectSchema, type CreateProjectBody } from '@promptliano/schemas'

export function ProjectForm() {
  const form = useZodForm({
    schema: createProjectSchema,
    defaultValues: {
      name: '',
      path: '',
      description: ''
    }
  })

  const createProject = useCreateProject()

  const onSubmit = (data: CreateProjectBody) => {
    createProject.mutate(data)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Controller
        name="name"
        control={form.control}
        render={({ field }) => (
          <Input
            {...field}
            placeholder="Project name"
            error={form.formState.errors.name?.message}
          />
        )}
      />
    </form>
  )
}
```

## UI Component Composition

### shadcn/ui Integration

```typescript
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@promptliano/ui'
import { Button } from '@promptliano/ui'

export function MyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogHeader>
        {/* Dialog content */}
      </DialogContent>
    </Dialog>
  )
}
```

### Sidebar Pattern (Modern shadcn/ui Sidebar)

```typescript
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  useSidebar
} from '@promptliano/ui'

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <Sidebar>
          <SidebarHeader>App Logo</SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/projects">Projects</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  )
}
```

## Error Boundary Patterns

### Global Error Boundary

```typescript
export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
            <h2 className="text-2xl font-bold">Something went wrong</h2>
            <p className="text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

### Component-Specific Error Boundaries

```typescript
export function ComponentErrorBoundary({
  children,
  componentName
}: {
  children: React.ReactNode
  componentName: string
}) {
  return (
    <ErrorBoundary fallback={`Error in ${componentName}`}>
      {children}
    </ErrorBoundary>
  )
}

// Usage in layout
<ComponentErrorBoundary componentName="Sidebar">
  <AppSidebar />
</ComponentErrorBoundary>
```

## Navigation and Command Patterns

### Global Command Palette

```typescript
export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false)

  useHotkeys('mod+k', (evt) => {
    evt.preventDefault()
    setOpen(true)
  })

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandGroup heading="Navigation">
          <NavigationCommands onSelect={() => setOpen(false)} />
        </CommandGroup>
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => navigate({ to: '/chat' })}>
            New Chat
            <CommandShortcut>⌘ N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

### Keyboard Shortcuts

```typescript
import { useHotkeys } from 'react-hotkeys-hook'

export function MyComponent() {
  useHotkeys('mod+f', (e) => {
    e.preventDefault()
    searchInputRef.current?.focus()
  })

  useHotkeys('mod+z', (e) => {
    e.preventDefault()
    if (canUndo) {
      undo()
      toast.success('Undo: Reverted file selection')
    }
  })
}
```

## Common Patterns and Best Practices

### 1. Route Prefetching

Always prefetch data in route `beforeLoad` functions:

```typescript
export const Route = createFileRoute('/projects')({
  beforeLoad: async ({ context }) => {
    const { queryClient, promptlianoClient } = context

    await queryClient.prefetchQuery({
      queryKey: ['projects'],
      queryFn: () => promptlianoClient.projects.listProjects(),
      staleTime: 5 * 60 * 1000
    })
  }
})
```

### 2. Search Parameter Handling

Always validate and handle search parameters properly:

```typescript
// REQUIRED: Add to search-schemas.ts
export const myRouteSearchSchema = z.object({
  myParam: z.string().catch('default').optional()
})

// Use in route
validateSearch: zodValidator(myRouteSearchSchema)
```

### 3. Toast Notifications

Use sonner for consistent toast notifications:

```typescript
import { toast } from 'sonner'

// Success
toast.success('Operation completed successfully')

// Error
toast.error('Something went wrong')

// Info with custom duration
toast.info('Migration completed', { duration: 5000 })
```

### 4. Loading States

Implement proper loading states:

```typescript
const { data, isLoading, error } = useGetProjects()

if (isLoading) {
  return <div className="flex items-center justify-center">Loading...</div>
}

if (error) {
  return <ErrorDisplay error={error} />
}

return <ProjectsList projects={data?.data || []} />
```

### 5. Responsive Design

Use mobile-first responsive patterns:

```typescript
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <div className="col-span-1 md:col-span-2">Main content</div>
  <div className="col-span-1">Sidebar</div>
</div>
```

## Testing Strategies

### Component Testing

```typescript
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MyComponent } from './my-component'

test('renders component correctly', () => {
  const queryClient = new QueryClient()

  render(
    <QueryClientProvider client={queryClient}>
      <MyComponent />
    </QueryClientProvider>
  )

  expect(screen.getByText('Expected text')).toBeInTheDocument()
})
```

### Hook Testing

```typescript
import { renderHook } from '@testing-library/react'
import { useMyHook } from './use-my-hook'

test('hook returns expected values', () => {
  const { result } = renderHook(() => useMyHook())

  expect(result.current.value).toBe('expected')
})
```

## Common Pitfalls and Solutions

### 1. Search Parameter Validation

**Problem**: URL parameters not working correctly
**Solution**: Always add new search parameters to the appropriate schema in `search-schemas.ts`

### 2. Query Cache Invalidation

**Problem**: Data not refreshing after mutations
**Solution**: Use proper invalidation patterns with query keys

### 3. Error Boundaries

**Problem**: Unhandled errors crashing the app
**Solution**: Wrap components in ErrorBoundary, especially at route level

### 4. Local Storage Sync

**Problem**: State not syncing between tabs
**Solution**: Use the KV local storage hooks which handle cross-tab sync

## Development Workflow

### 1. Adding a New Feature

1. Create feature directory under `components/`
2. Add necessary API hooks to `hooks/api/`
3. Add route if needed with proper search schema validation
4. Implement components with error boundaries
5. Add keyboard shortcuts and accessibility features
6. Write tests for critical paths

### 2. Adding a New Route

1. Create route file in `routes/`
2. Define search schema in `search-schemas.ts`
3. Add prefetching in `beforeLoad`
4. Implement component with proper loading/error states
5. Add navigation links in sidebar or command palette

### 3. Adding New API Integration

1. Add API client method in `@promptliano/api-client`
2. Create hook in `hooks/api/`
3. Add query keys and invalidation logic
4. Export from `api-hooks.ts`
5. Use in components with proper error handling

This client package follows modern React patterns with an emphasis on type safety, performance, and user experience. Always prioritize error boundaries, proper loading states, and accessibility when building new features.
