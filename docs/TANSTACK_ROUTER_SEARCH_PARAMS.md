# TanStack Router Search Params Guidelines

## IMPORTANT: Always Use Zod Validation for ALL Search Params

When implementing tabs or any UI state that should persist across page refreshes, **ALWAYS** use TanStack Router search params with Zod validation.

### Why This Matters

- **User Experience**: Users can bookmark specific states, share links, and use browser back/forward
- **State Persistence**: Tab selections, view modes, and filters survive page refreshes
- **Type Safety**: Zod schemas provide runtime validation and TypeScript types
- **Graceful Fallbacks**: Invalid URLs automatically fall back to safe defaults

### Implementation Pattern

1. **Define Search Schema** (in `lib/search-schemas.ts`):

```typescript
export const myViewSchema = z
  .enum(['view1', 'view2', 'view3'])
  .catch('view1') // Default fallback
  .optional()

export const myRouteSearchSchema = z.object({
  activeView: myViewSchema,
  selectedId: z.coerce.number().optional().catch(undefined),
  filter: z.string().optional().catch('')
})
```

2. **Add to Route**:

```typescript
export const Route = createFileRoute('/my-route')({
  validateSearch: zodValidator(myRouteSearchSchema),
  component: MyComponent
})
```

3. **Use in Component**:

```typescript
const search = Route.useSearch()
const navigate = useNavigate()

// Read state
const currentView = search.activeView || 'view1'

// Update state
navigate({
  to: '/my-route',
  search: (prev) => ({ ...prev, activeView: 'view2' }),
  replace: true // Don't create history entry for tab changes
})
```

### Common Patterns

#### Tabs

```typescript
<Tabs
  value={search.activeView || 'default'}
  onValueChange={(value) => {
    navigate({
      to: '/current-route',
      search: (prev) => ({ ...prev, activeView: value }),
      replace: true
    })
  }}
>
```

#### Sub-navigation

```typescript
// For nested views (e.g., git view -> branches sub-view)
onGitViewChange={(view) => {
  navigate({
    to: '/projects',
    search: (prev) => ({ ...prev, gitView: view }),
    replace: true
  })
}}
```

#### Conditional Tabs

```typescript
// When tabs appear conditionally, ensure the validation handles all cases
export const projectViewSchema = z
  .enum([
    'context',
    'stats',
    'claude-code' // Even if conditional, include in schema
  ])
  .catch('context')
  .optional()
```

### Best Practices

1. **Always use `.catch()` for safe defaults**
2. **Use `.optional()` for optional params**
3. **Use `z.coerce.number()` for numeric IDs from URLs**
4. **Use `replace: true` for UI state changes to avoid cluttering history**
5. **Include ALL possible values in enums, even conditional ones**

### Example: Claude Code Tab Integration

```typescript
// 1. Schema (search-schemas.ts)
export const projectViewSchema = z.enum([
  'context',
  'stats',
  'claude-code'  // Include even though it's conditional
]).catch('context').optional()

export const claudeCodeViewSchema = z.enum(['agents', 'sessions', 'chats'])
  .catch('agents').optional()

// 2. Component
const search = Route.useSearch()

// 3. Tab trigger (only rendered when enabled)
{activeProjectTabState?.claudeCodeEnabled && (
  <TabsTrigger value='claude-code'>Claude Code</TabsTrigger>
)}

// 4. Tab content (handles the view param)
<TabsContent value='claude-code'>
  <ClaudeCodeTabWithSidebar
    claudeCodeView={search.claudeCodeView}
    onClaudeCodeViewChange={(view) => {
      navigate({
        to: '/projects',
        search: (prev) => ({ ...prev, claudeCodeView: view }),
        replace: true
      })
    }}
  />
</TabsContent>
```

### Debugging Tips

1. **Check browser URL**: Ensure params are being set correctly
2. **Console log `search`**: Verify parsed values
3. **Check schema validation**: Use `.safeParse()` to debug
4. **Verify enum values**: Ensure all possible values are in the schema

Remember: Every piece of UI state that users would want to persist should be in the URL!
