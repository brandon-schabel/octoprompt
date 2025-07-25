# TanStack Router Advanced Patterns in OctoPrompt

This directory contains utilities and patterns for leveraging TanStack Router v1's advanced features.

## Overview

We've implemented several advanced TanStack Router patterns to improve:

- URL parameter management
- Type safety
- Data loading performance
- Authentication flows
- Code organization

## Key Features

### 1. Search Middleware (`search-middleware.ts`)

Search middleware automatically manages URL parameters across navigation:

```typescript
// Persist project context across routes
export const persistProjectParams = retainSearchParams(['projectId', 'tab'])

// Clean default values from URLs
export const stripDefaultParams = stripSearchParams({
  tab: '0',
  limit: 20,
  offset: 0
})

// Use in route definition
export const Route = createFileRoute('/projects')({
  search: {
    middlewares: [persistProjectParams, stripDefaultParams]
  }
})
```

### 2. Router Context (`main.tsx`)

Inject dependencies through router context:

```typescript
const router = createRouter({
  routeTree,
  context: {
    queryClient // TanStack Query client
    // Add other global dependencies here
  }
})

// Access in any route
export const Route = createFileRoute('/example')({
  loader: ({ context }) => {
    // Use context.queryClient
  }
})
```

### 3. Data Loaders (`loaders.ts`)

Prefetch data before components render:

```typescript
export const Route = createFileRoute('/projects/$projectId')({
  loader: async ({ context, params }) => {
    // Prefetch using TanStack Query
    await context.queryClient.ensureQueryData({
      queryKey: ['project', params.projectId],
      queryFn: () => fetchProject(params.projectId)
    })
  },
  component: ProjectPage
})
```

### 4. Authentication with beforeLoad (`auth.ts`)

Check authentication before loading routes:

```typescript
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const auth = getAuthState()

    if (!auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href }
      })
    }

    return { auth } // Merge into context
  }
})
```

### 5. Type-Safe Navigation (`navigation.ts`)

Helper functions for type-safe navigation:

```typescript
const { toProjects, toChat } = useTypedNavigate()

// Navigate with typed search params
toProjects({ projectId: 123, tab: 'files' })
toChat({ chatId: 456, prefill: true })
```

## Implementation Guide

### Basic Route with Search Params

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
  filter: z.string().optional(),
  page: z.number().optional().default(1)
})

export const Route = createFileRoute('/items')({
  validateSearch: searchSchema,
  component: ItemsPage
})

function ItemsPage() {
  const { filter, page } = Route.useSearch()
  // Use typed search params
}
```

### Route with Loader and Context

```typescript
export const Route = createFileRoute('/data')({
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ['data'],
      queryFn: fetchData
    })
  },
  component: DataPage
})
```

### Protected Route Pattern

```typescript
export const Route = createFileRoute('/_auth/dashboard')({
  beforeLoad: requireAuth,
  component: Dashboard
})
```

## Best Practices

1. **Use Search Middleware** for common parameters that should persist across navigation
2. **Leverage Context** for dependency injection instead of prop drilling
3. **Prefetch in Loaders** to eliminate loading waterfalls
4. **Validate Search Params** with Zod for runtime safety
5. **Use beforeLoad** for route guards and authentication

## Migration Guide

To migrate existing routes:

1. Add search schema validation
2. Move data fetching to loaders
3. Replace manual navigation with typed helpers
4. Add search middleware for persistent params
5. Use beforeLoad for authentication checks

## Example Route

See `/routes/example-advanced.tsx` for a complete example demonstrating all patterns.
