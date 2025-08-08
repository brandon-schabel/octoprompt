# Promptliano React Hooks Architecture Guide

This guide documents the React hooks patterns, TanStack Query integration, and best practices used throughout the Promptliano client application.

## Architecture Overview

The hooks system is organized into several layers:

```
hooks/
├── api/                     # TanStack Query API hooks
│   ├── common-mutation-error-handler.ts
│   ├── use-*-api.ts         # Domain-specific API hooks
├── chat/                    # Chat-specific business logic hooks
├── utility-hooks/           # Reusable utility hooks
├── api-hooks.ts            # Consolidated API hooks (legacy)
├── promptliano-client.ts   # API client configuration
├── use-kv-local-storage.ts # KV storage hooks
└── use-zod-hook-form.ts    # Form validation hooks
```

### Key Principles

- **Query Key Hierarchies**: Consistent hierarchical query key patterns for cache management
- **Invalidation Strategies**: Granular invalidation utilities for optimal cache updates
- **Error Handling**: Centralized error handling with toast notifications
- **Type Safety**: Full TypeScript integration with Zod validation
- **Local Storage**: Cross-tab synchronized local storage hooks

## API Hooks Patterns

### 1. Query Key Patterns

All API hooks follow a consistent hierarchical query key pattern:

```typescript
const ENTITY_KEYS = {
  all: ['entity'] as const,
  lists: () => [...ENTITY_KEYS.all, 'list'] as const,
  list: (projectId: number, status?: string) => [...ENTITY_KEYS.lists(), { projectId, status }] as const,
  details: () => [...ENTITY_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...ENTITY_KEYS.details(), id] as const,
  relations: (id: number, relation: string) => [...ENTITY_KEYS.all, relation, id] as const
}
```

**Benefits:**

- Enables precise cache invalidation
- Supports partial cache clearing
- Maintains cache hierarchy integrity
- TypeScript-safe query key construction

### 2. Query Hook Structure

Standard query hooks follow this pattern:

```typescript
export function useGetEntity(id: number) {
  return useQuery({
    queryKey: ENTITY_KEYS.detail(id),
    queryFn: () => promptlianoClient.entity.getEntity(id),
    enabled: !!id && id !== -1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true
  })
}
```

**Key Features:**

- `enabled` guards prevent unnecessary requests
- `staleTime` set based on data volatility
- Consistent error handling through client configuration

### 3. Mutation Hook Patterns

Mutation hooks include optimistic updates and cache invalidation:

```typescript
export function useCreateEntity() {
  const { invalidateAll, setDetail } = useInvalidateEntities()

  return useMutation({
    mutationFn: (data: CreateEntityBody) => promptlianoClient.entity.createEntity(data),
    onSuccess: (newEntity) => {
      invalidateAll()
      setDetail(newEntity)
      toast.success('Entity created successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create entity')
    }
  })
}
```

### 4. Invalidation Utilities

Each domain has dedicated invalidation utilities:

```typescript
export function useInvalidateEntities() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ENTITY_KEYS.all })
    },
    invalidateDetail: (id: number) => {
      queryClient.invalidateQueries({ queryKey: ENTITY_KEYS.detail(id) })
    },
    removeEntity: (id: number) => {
      queryClient.removeQueries({ queryKey: ENTITY_KEYS.detail(id) })
    },
    setDetail: (entity: Entity) => {
      queryClient.setQueryData(ENTITY_KEYS.detail(entity.id), entity)
    }
  }
}
```

## TanStack Query Configuration

### Stale Times by Data Type

```typescript
// From lib/constants.ts
export const TICKETS_STALE_TIME = 30 * 1000 // 30 seconds
export const QUEUE_REFETCH_INTERVAL = 5000 // 5 seconds

// Common stale times:
const STALE_TIMES = {
  // Volatile data (frequently changing)
  messages: 30 * 1000, // 30 seconds
  tasks: 30 * 1000, // 30 seconds

  // Semi-stable data
  projects: 5 * 60 * 1000, // 5 minutes
  chats: 5 * 60 * 1000, // 5 minutes

  // Stable data
  keys: 10 * 60 * 1000, // 10 minutes
  settings: 10 * 60 * 1000 // 10 minutes
}
```

### Retry Configuration

```typescript
export function useResilientQuery() {
  return useQuery({
    retry: RETRY_MAX_ATTEMPTS, // 2 attempts
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, RETRY_MAX_DELAY)
  })
}
```

## Cache Invalidation Strategies

### 1. Granular Invalidation

Target specific cache entries:

```typescript
// Invalidate specific project
invalidateProject(projectId)

// Invalidate all project files
invalidateProjectFiles(projectId)

// Invalidate entire project data tree
invalidateProjectData(projectId)
```

### 2. Optimistic Updates

Update cache immediately, rollback on error:

```typescript
export function useOptimisticUpdate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateEntity,
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ENTITY_KEYS.detail(id) })

      // Snapshot previous value
      const previousData = queryClient.getQueryData(ENTITY_KEYS.detail(id))

      // Optimistically update
      queryClient.setQueryData(ENTITY_KEYS.detail(id), newData)

      return { previousData }
    },
    onError: (err, newData, context) => {
      // Rollback on error
      queryClient.setQueryData(ENTITY_KEYS.detail(id), context?.previousData)
    }
  })
}
```

### 3. Background Refresh

Keep data fresh without blocking UI:

```typescript
export function useSmartCaching() {
  const queryClient = useQueryClient()

  return {
    backgroundRefresh: (queryKeys: any[][]) => {
      queryKeys.forEach((queryKey) => {
        queryClient.invalidateQueries({
          queryKey,
          refetchType: 'none' // Don't block UI
        })
      })
    }
  }
}
```

## Local Storage Hooks

### KV Storage Pattern

Type-safe local storage with cross-tab synchronization:

```typescript
export function useGetKvValue<K extends KVKey>(key: K) {
  const [value, setValue] = useLocalStorage<KVValue<K>>(key, KVDefaultValues[key])

  const safeValue = useMemo(() => {
    try {
      return value // Validation happens in useLocalStorage
    } catch (error) {
      console.warn(`Invalid value for key ${key}, using default:`, error)
      return KVDefaultValues[key]
    }
  }, [value, key])

  return [safeValue, setValue] as const
}
```

### Cross-Tab Synchronization

```typescript
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => getStorageValue(key, initialValue))

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && event.key === key) {
        // Sync across tabs
        const newValue = event.newValue ? JSON.parse(event.newValue) : initialValue
        setStoredValue(newValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key, initialValue])
}
```

## Form Validation Hooks

### Zod Integration

```typescript
export default function useZodForm<T extends z.ZodType>({
  schema,
  ...formProps
}: UseZodFormProps<T>): UseFormReturn<z.infer<T>> {
  return useForm({
    ...formProps,
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onSubmit'
  })
}
```

**Usage:**

```typescript
const form = useZodForm({
  schema: CreateProjectSchema,
  defaultValues: {
    name: '',
    path: ''
  }
})
```

## AI Chat Hooks

### Vercel AI SDK Integration

The `useAIChat` hook integrates TanStack Query with Vercel AI SDK:

```typescript
export function useAIChat({ chatId, provider, model, systemMessage }: UseAIChatProps) {
  const [parsedError, setParsedError] = useState<ReturnType<typeof parseAIError> | null>(null)

  const { messages, input, isLoading, error, setMessages, append, stop } = useChat({
    api: `${SERVER_HTTP_ENDPOINT}/api/ai/chat`,
    id: chatId.toString(),
    initialMessages: [],
    onError: (err) => {
      const providerName = extractProviderName(err) || provider
      const parsed = parseAIError(err, providerName)
      setParsedError(parsed)

      // Show appropriate toast based on error type
      if (parsed.type === 'MISSING_API_KEY') {
        toast.error('API Key Missing', {
          description: parsed.message,
          action: { label: 'Settings', onClick: () => (window.location.href = '/settings') }
        })
      }
    }
  })

  const sendMessage = useCallback(
    async (messageContent: string, modelSettings?: AiSdkOptions) => {
      const requestBody: AiChatStreamRequest = {
        chatId,
        userMessage: messageContent.trim(),
        tempId: Date.now(),
        ...(systemMessage && { systemMessage }),
        ...(modelSettings && { options: modelSettings })
      }

      await append(
        {
          id: Date.now().toString(),
          role: 'user',
          content: messageContent.trim(),
          createdAt: new Date()
        },
        { body: requestBody }
      )
    },
    [append, chatId, systemMessage]
  )

  return {
    messages,
    input,
    isLoading,
    error,
    parsedError,
    sendMessage,
    stop,
    clearError: () => setParsedError(null)
  }
}
```

## Utility Hooks

### Debouncing

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

export function useDebounceCallback<T extends (...args: any[]) => void>(callback: T, delay: number): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => callback(...args), delay)
    },
    [callback, delay]
  ) as T
}
```

### Click Away

```typescript
export const useClickAway = <E extends Event = Event>(
  ref: RefObject<HTMLElement | null>,
  onClickAway: (event: E) => void,
  events: string[] = ['mousedown', 'touchstart']
) => {
  const savedCallback = useRef(onClickAway)

  useEffect(() => {
    savedCallback.current = onClickAway
  }, [onClickAway])

  useEffect(() => {
    const handler = (event: any) => {
      const { current: el } = ref
      el && !el.contains(event.target) && savedCallback.current(event)
    }

    events.forEach((eventName) => window.addEventListener(eventName, handler))
    return () => events.forEach((eventName) => window.removeEventListener(eventName, handler))
  }, [events, ref])
}
```

## Error Handling

### Common Error Handler

```typescript
import { ApiError } from 'shared/index'
import { toast } from 'sonner'

export const commonErrorHandler = (error: Error) => {
  if (error instanceof ApiError) {
    const message = `API Error [${error.code}]: ${error.message}`
    toast(message)
  }
}
```

### Usage in Mutations

```typescript
export function useCreateEntity() {
  return useMutation({
    mutationFn: createEntity,
    onError: commonErrorHandler // Centralized error handling
  })
}
```

## Testing Hooks

### Testing Query Hooks

```typescript
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGetProject } from './use-projects-api'

test('useGetProject returns project data', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })

  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  const { result } = renderHook(() => useGetProject(1), { wrapper })

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true)
  })
})
```

### Testing Mutation Hooks

```typescript
test('useCreateProject creates project and invalidates cache', async () => {
  const queryClient = new QueryClient()
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

  const { result } = renderHook(() => useCreateProject(), {
    wrapper: createWrapper(queryClient)
  })

  await act(async () => {
    await result.current.mutateAsync({ name: 'Test', path: '/test' })
  })

  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: PROJECT_KEYS.all })
})
```

## Performance Patterns

### 1. Query Prefetching

```typescript
export function useSmartCaching() {
  const queryClient = useQueryClient()

  return {
    preloadRelatedProject: async (projectId: number) => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: PROJECT_KEYS.files(projectId),
          queryFn: () => promptlianoClient.projects.getProjectFiles(projectId)
        }),
        queryClient.prefetchQuery({
          queryKey: PROMPT_KEYS.projectPrompts(projectId),
          queryFn: () => promptlianoClient.prompts.listProjectPrompts(projectId)
        })
      ])
    }
  }
}
```

### 2. Selective Invalidation

```typescript
export function useInvalidateProjects() {
  const queryClient = useQueryClient()

  return {
    // Invalidate specific project data without affecting others
    invalidateProjectData: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(projectId) })
      queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.projectPrompts(projectId) })
    }
  }
}
```

### 3. Background Refresh

```typescript
export function useBackgroundRefresh() {
  const queryClient = useQueryClient()

  return {
    refreshStaleData: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          return query.isStale() && !query.isFetching()
        },
        refetchType: 'none' // Don't block UI
      })
    }
  }
}
```

## Best Practices

### 1. Hook Organization

- **Domain-specific hooks**: Group related API hooks by domain (tickets, projects, etc.)
- **Utility hooks**: Keep reusable utilities in `/utility-hooks/`
- **Business logic**: Combine multiple hooks for complex business logic
- **Export patterns**: Use consistent export patterns for discoverability

### 2. Cache Management

- **Hierarchical keys**: Use consistent hierarchical query key patterns
- **Granular invalidation**: Invalidate only what changed
- **Optimistic updates**: Use for immediate feedback on mutations
- **Background refresh**: Keep data fresh without blocking UI

### 3. Error Handling

- **Centralized handlers**: Use common error handlers for consistency
- **User-friendly messages**: Provide actionable error messages with toasts
- **Error boundaries**: Combine with React error boundaries for resilience
- **Retry strategies**: Configure appropriate retry logic based on data criticality

### 4. Type Safety

- **Generic hooks**: Use TypeScript generics for reusable patterns
- **Zod validation**: Validate all external data with Zod schemas
- **Type inference**: Leverage TypeScript's type inference where possible
- **Strict typing**: Avoid `any` types, prefer proper type definitions

### 5. Performance

- **Stale times**: Set appropriate stale times based on data volatility
- **Enabled guards**: Use `enabled` to prevent unnecessary requests
- **Query deduplication**: TanStack Query handles this automatically
- **Pagination**: Implement proper pagination for large datasets

## Migration Guidelines

### Converting Legacy Hooks

When converting from legacy patterns:

1. **Extract query keys**: Create hierarchical query key objects
2. **Add invalidation utilities**: Create domain-specific invalidation hooks
3. **Standardize error handling**: Use common error handlers
4. **Update imports**: Update imports to use new hook locations
5. **Add TypeScript**: Ensure full type safety

### Example Migration

```typescript
// Before (legacy)
export function useProject(id: number) {
  return useQuery(['project', id], () => api.getProject(id))
}

// After (new pattern)
const PROJECT_KEYS = {
  all: ['projects'] as const,
  detail: (id: number) => [...PROJECT_KEYS.all, 'detail', id] as const
}

export function useGetProject(id: number) {
  return useQuery({
    queryKey: PROJECT_KEYS.detail(id),
    queryFn: () => promptlianoClient.projects.getProject(id),
    enabled: !!id && id !== -1,
    staleTime: 5 * 60 * 1000
  })
}
```

This architecture provides a solid foundation for scalable, maintainable, and performant data management in the Promptliano client application.
