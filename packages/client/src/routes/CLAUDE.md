# CLAUDE.md - Client Routes with TanStack Router

## Package Overview

The client routes package implements file-based routing using TanStack Router v1, providing type-safe navigation, search parameter validation with Zod, and seamless integration with React Query for data fetching. This documentation covers the complete routing architecture and patterns used in the Promptliano client application.

## Agent Integration Requirements

### Required Agents for Route Development

When implementing new routes or modifying routing logic, you MUST use these specialized agents:

1. **tanstack-router-expert** - For all routing implementation, navigation patterns, and route configuration
2. **promptliano-ui-architect** - For UI components within routes
3. **zod-schema-architect** - For search parameter schema validation
4. **staff-engineer-code-reviewer** - MANDATORY after implementing any route changes

### Agent Workflow Example

```typescript
// 1. Use tanstack-router-expert to design route structure
// 2. Use zod-schema-architect for search params schema
// 3. Use promptliano-ui-architect for UI components
// 4. Use staff-engineer-code-reviewer to validate implementation
```

## TanStack Router File-Based Routing

### Route File Structure

```
src/routes/
├── __root.tsx           # Root layout with providers and context
├── index.tsx            # Home route (redirects to /projects)
├── projects.tsx         # Projects dashboard with complex search params
├── chat.tsx             # Chat interface route
├── providers.tsx        # Provider configuration route
├── settings.tsx         # Settings with tab navigation
├── tickets.tsx          # Ticket management route
├── assets.tsx           # Asset management route
├── queue-dashboard.tsx  # Queue dashboard route
└── routeTree.gen.ts     # Auto-generated route tree (DO NOT EDIT)
```

### Creating a New Route

#### Step 1: Create Route File

```typescript
// src/routes/my-feature.tsx
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

// Define search parameter schema
const myFeatureSearchSchema = z.object({
  tab: z.enum(['overview', 'details', 'settings']).catch('overview').optional(),
  itemId: z.coerce.number().optional().catch(undefined),
  filter: z.string().optional().catch(undefined)
})

// Export type for use in other components
export type MyFeatureSearch = z.infer<typeof myFeatureSearchSchema>

// Create the route
export const Route = createFileRoute('/my-feature')({
  // Validate search parameters with Zod
  validateSearch: zodValidator(myFeatureSearchSchema),

  // Optional: Load data before rendering
  beforeLoad: async ({ context, search }) => {
    // Access router context (queryClient, promptlianoClient)
    const data = await context.promptlianoClient.fetchData(search.itemId)
    return { data }
  },

  // Component to render
  component: MyFeaturePage
})

// Component implementation
function MyFeaturePage() {
  const search = Route.useSearch() // Type-safe search params
  const navigate = useNavigate()
  const { data } = Route.useRouteContext() // Access loaded data

  return (
    <div>
      {/* Your component implementation */}
    </div>
  )
}
```

#### Step 2: Add Search Schema to search-schemas.ts

```typescript
// src/lib/search-schemas.ts

// Add enum for tabs if needed
export const myFeatureViewSchema = z.enum(['overview', 'details', 'settings']).catch('overview').optional()

// Create search schema
export const myFeatureSearchSchema = z.object({
  tab: myFeatureViewSchema,
  itemId: z.coerce.number().optional().catch(undefined),
  filter: z.string().optional().catch(undefined)
})

// Export type
export type MyFeatureSearch = z.infer<typeof myFeatureSearchSchema>
```

## Search Parameter Validation

### Zod Schema Patterns

All search parameters MUST be validated using Zod schemas with `.catch()` for graceful error handling:

```typescript
// CORRECT: With .catch() for error resilience
const schema = z.object({
  id: z.coerce.number().optional().catch(undefined),
  status: z.enum(['active', 'inactive']).catch('active'),
  query: z.string().optional().catch(undefined)
})

// INCORRECT: Without .catch() - will throw on invalid params
const schema = z.object({
  id: z.coerce.number().optional(), // Missing .catch()
  status: z.enum(['active', 'inactive']) // Missing .catch()
})
```

### Common Schema Patterns

```typescript
// Numeric IDs (coerce string to number)
projectId: z.coerce.number().optional().catch(undefined)

// Enums with fallback
tab: z.enum(['tab1', 'tab2', 'tab3']).catch('tab1').optional()

// Boolean flags
enabled: z.boolean().catch(false).optional()

// String searches
query: z.string().optional().catch(undefined)

// Arrays
selectedIds: z.array(z.coerce.number()).catch([]).optional()
```

## Navigation Patterns

### Programmatic Navigation

```typescript
import { useNavigate } from '@tanstack/react-router'

function MyComponent() {
  const navigate = useNavigate()

  // Navigate with search params
  const handleTabChange = (tab: string) => {
    navigate({
      to: '/projects',
      search: (prev) => ({ ...prev, tab }),
      replace: true // Replace history entry instead of push
    })
  }

  // Navigate to different route
  const goToSettings = () => {
    navigate({
      to: '/settings',
      search: { tab: 'general' }
    })
  }
}
```

### Link Component Navigation

```typescript
import { Link } from '@tanstack/react-router'

// Type-safe links with search params
<Link
  to="/projects"
  search={{ projectId: 123, tab: 'flow' }}
  className="hover:underline"
>
  View Project
</Link>

// Preserve existing search params
<Link
  to="/projects"
  search={(prev) => ({ ...prev, tab: 'git' })}
>
  Git View
</Link>
```

### Redirect Pattern

```typescript
// Immediate redirect in route definition
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({
      to: '/projects',
      search: { tab: 'context' }
    })
  }
})

// Conditional redirect
export const Route = createFileRoute('/protected')({
  beforeLoad: async ({ context }) => {
    const isAuthenticated = await context.authClient.check()
    if (!isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  }
})
```

## Route Context and Data Loading

### Setting Up Router Context

```typescript
// main.tsx
export interface RouterContext {
  queryClient: QueryClient
  promptlianoClient: typeof promptlianoClient
  authClient: AuthClient // Custom services
}

const router = createRouter({
  routeTree,
  context: {
    queryClient,
    promptlianoClient,
    authClient
  }
})
```

### Using Context in Routes

```typescript
export const Route = createFileRoute('/data')({
  beforeLoad: async ({ context }) => {
    // Access context services
    const projects = await context.promptlianoClient.projects.list()
    return { projects }
  },

  component: DataPage
})

function DataPage() {
  // Access loaded data
  const { projects } = Route.useRouteContext()

  // Access router context
  const { promptlianoClient } = useRouterContext()
}
```

## Tab Navigation Pattern

### Implementation Example

```typescript
// Route with tabs
export const Route = createFileRoute('/settings')({
  validateSearch: zodValidator(settingsSearchSchema),
  component: SettingsPage
})

function SettingsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <Tabs
      value={search.tab || 'general'}
      onValueChange={(value) => {
        navigate({
          to: '/settings',
          search: { tab: value as SettingsTab },
          replace: true // Important: Replace to avoid history spam
        })
      }}
    >
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        {/* General settings */}
      </TabsContent>

      <TabsContent value="advanced">
        {/* Advanced settings */}
      </TabsContent>
    </Tabs>
  )
}
```

## Complex Route Example: Projects

The projects route demonstrates advanced patterns:

```typescript
// Multiple nested tab levels
export const projectsSearchSchema = z.object({
  projectId: z.coerce.number().optional().catch(undefined),
  activeView: z.enum(['context', 'flow', 'git', 'manage']).catch('context'),

  // Sub-navigation for each view
  flowView: z.enum(['queues', 'tickets', 'kanban']).catch('queues'),
  gitView: z.enum(['changes', 'history', 'branches']).catch('changes'),

  // Additional state
  selectedTicketId: z.coerce.number().optional().catch(undefined),
  gitBranch: z.string().optional().catch(undefined)
})

// Route handles complex state management
function ProjectsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  // Main view navigation
  const handleViewChange = (view: ProjectView) => {
    navigate({
      search: (prev) => ({ ...prev, activeView: view }),
      replace: true
    })
  }

  // Sub-view navigation
  const handleFlowViewChange = (flowView: FlowView) => {
    navigate({
      search: (prev) => ({ ...prev, flowView }),
      replace: true
    })
  }

  // Render based on active view
  return (
    <div>
      {search.activeView === 'flow' && <FlowView subView={search.flowView} />}
      {search.activeView === 'git' && <GitView subView={search.gitView} />}
    </div>
  )
}
```

## Integration with React Query

### Data Fetching in Routes

```typescript
import { useQuery } from '@tanstack/react-query'

function ProjectPage() {
  const { projectId } = Route.useSearch()

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => promptlianoClient.projects.get(projectId),
    enabled: !!projectId // Only fetch if projectId exists
  })

  if (isLoading) return <LoadingSpinner />
  if (!project) return <NotFound />

  return <ProjectDetails project={project} />
}
```

### Prefetching in beforeLoad

```typescript
export const Route = createFileRoute('/project/$id')({
  beforeLoad: async ({ context, params }) => {
    // Prefetch data into React Query cache
    await context.queryClient.prefetchQuery({
      queryKey: ['project', params.id],
      queryFn: () => context.promptlianoClient.projects.get(params.id)
    })
  },

  component: ProjectPage
})
```

## Route Guards and Authentication

### Protected Route Pattern

```typescript
export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context }) => {
    const user = await context.authClient.getCurrentUser()

    if (!user) {
      throw redirect({ to: '/login' })
    }

    if (user.role !== 'admin') {
      throw redirect({ to: '/unauthorized' })
    }

    return { user }
  },

  component: AdminDashboard
})
```

## Performance Optimization

### Lazy Loading Routes

```typescript
// Use lazy loading for large route components
const ProjectsLazy = lazy(() => import('./components/ProjectsPage'))

export const Route = createFileRoute('/projects')({
  component: () => (
    <Suspense fallback={<LoadingSpinner />}>
      <ProjectsLazy />
    </Suspense>
  )
})
```

### Search Parameter Debouncing

```typescript
import { useDebouncedCallback } from 'use-debounce'

function SearchableList() {
  const navigate = useNavigate()

  // Debounce search parameter updates
  const handleSearch = useDebouncedCallback((query: string) => {
    navigate({
      search: (prev) => ({ ...prev, query }),
      replace: true
    })
  }, 300)

  return (
    <Input
      placeholder="Search..."
      onChange={(e) => handleSearch(e.target.value)}
    />
  )
}
```

## Testing Routes

### Unit Testing Route Components

```typescript
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from '@tanstack/react-router'

describe('ProjectsRoute', () => {
  it('should render with search params', () => {
    const router = createMemoryRouter({
      routeTree,
      initialLocation: '/projects?projectId=123&tab=flow'
    })

    const { getByText } = render(
      <RouterProvider router={router} />
    )

    expect(getByText('Flow View')).toBeInTheDocument()
  })
})
```

## Common Patterns and Best Practices

### 1. Always Use .catch() in Zod Schemas

```typescript
// ✅ CORRECT - Resilient to invalid params
z.enum(['a', 'b', 'c']).catch('a')

// ❌ INCORRECT - Will throw on invalid params
z.enum(['a', 'b', 'c'])
```

### 2. Use replace: true for UI State Changes

```typescript
// ✅ CORRECT - Doesn't spam browser history
navigate({ search: { tab }, replace: true })

// ❌ INCORRECT - Creates history entry for each tab change
navigate({ search: { tab } })
```

### 3. Preserve Existing Search Params

```typescript
// ✅ CORRECT - Preserves other params
navigate({ search: (prev) => ({ ...prev, newParam: value }) })

// ❌ INCORRECT - Overwrites all params
navigate({ search: { newParam: value } })
```

### 4. Type-Safe Route Params

```typescript
// Define params schema
const Route = createFileRoute('/user/$userId')({
  parseParams: (params) => ({
    userId: z.coerce.number().parse(params.userId)
  }),
  component: UserProfile
})

// Use typed params
function UserProfile() {
  const { userId } = Route.useParams() // userId is number
}
```

### 5. Handle Loading and Error States

```typescript
export const Route = createFileRoute('/data')({
  loader: async () => {
    return await fetchData()
  },

  errorComponent: ({ error }) => <ErrorBoundary error={error} />,
  pendingComponent: () => <LoadingSpinner />,
  component: DataView
})
```

## Common Pitfalls to Avoid

### 1. Missing Validation Schema Updates

When adding new search params, ALWAYS update:

- The Zod schema in search-schemas.ts
- The TypeScript type export
- Any switch statements handling the param

### 2. Incorrect Navigation Replace

```typescript
// ❌ BAD - Creates history entry for every keystroke
const handleSearch = (query: string) => {
  navigate({ search: { query } }) // Missing replace: true
}

// ✅ GOOD - Replaces current entry
const handleSearch = (query: string) => {
  navigate({ search: { query }, replace: true })
}
```

### 3. Not Handling Invalid Route States

```typescript
// ❌ BAD - Assumes projectId always exists
const projectId = search.projectId!
const project = await fetchProject(projectId)

// ✅ GOOD - Handles missing projectId
if (!search.projectId) {
  return <NoProjectSelected />
}
const project = await fetchProject(search.projectId)
```

### 4. Forgetting Route Context Types

```typescript
// ❌ BAD - No type safety
const context = useRouterContext()

// ✅ GOOD - Full type safety
const context = useRouterContext<RouterContext>()
```

## Migration Guide from React Router

### Key Differences

1. **File-based routing** - Routes are defined in files, not JSX
2. **Built-in search params** - First-class support with validation
3. **Type safety** - Full TypeScript integration
4. **Context passing** - Router-level context instead of providers

### Migration Example

```typescript
// React Router v6
<Route path="/projects" element={<Projects />}>
  <Route path=":id" element={<ProjectDetail />} />
</Route>

// TanStack Router
// src/routes/projects.tsx
export const Route = createFileRoute('/projects')({
  component: Projects
})

// src/routes/projects.$id.tsx
export const Route = createFileRoute('/projects/$id')({
  component: ProjectDetail
})
```

## Route Tree Generation

The route tree is automatically generated by TanStack Router CLI:

```bash
# Watches for route file changes and regenerates
bun run dev

# Manual generation
bunx @tanstack/router-cli generate
```

Configuration in vite.config.ts:

```typescript
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts'
    })
  ]
})
```

## Performance Monitoring

### Route Change Tracking

```typescript
router.subscribe('onBeforeLoad', ({ pathname, search }) => {
  console.log('Route loading:', pathname, search)
})

router.subscribe('onLoad', ({ pathname, loadTime }) => {
  analytics.track('route_loaded', {
    path: pathname,
    duration: loadTime
  })
})
```

## Debugging Routes

### Enable Router DevTools

```typescript
// main.tsx
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  // Enable devtools in development
  ...(import.meta.env.DEV && {
    routerDevtools: {
      position: 'bottom-right'
    }
  })
})
```

### Logging Search Params

```typescript
function DebugRoute() {
  const search = Route.useSearch()

  useEffect(() => {
    console.log('Search params:', search)
  }, [search])

  return <pre>{JSON.stringify(search, null, 2)}</pre>
}
```

## Summary

TanStack Router provides a powerful, type-safe routing solution for the Promptliano client. Key takeaways:

1. **Always validate search params** with Zod schemas using `.catch()`
2. **Use replace: true** for UI state changes
3. **Leverage beforeLoad** for data prefetching
4. **Maintain type safety** throughout navigation
5. **Follow file-based routing** conventions
6. **Use specialized agents** for implementation

When implementing routes, always use the appropriate agents (tanstack-router-expert, zod-schema-architect) and finish with staff-engineer-code-reviewer for quality assurance.
