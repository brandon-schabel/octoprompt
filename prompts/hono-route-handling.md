# Hono Route Handling: Avoiding Conflicts & Understanding Route Matching

## Overview

Hono uses a **first-match-wins** routing algorithm where routes are matched in the order they are registered. Understanding this behavior is critical for building reliable APIs, especially when dealing with parameterized routes and specific endpoints.

## Route Matching Algorithm

### 1. Sequential Matching

```typescript
// Routes are matched in registration order
app
  .get('/users/{id}', handler1)     // Registered first
  .get('/users/profile', handler2)  // Registered second - NEVER REACHED!
```

When a request comes to `/users/profile`:

1. Hono checks the first route: `/users/{id}`
2. Pattern matches: `profile` becomes the `{id}` parameter
3. First route wins, `handler1` executes with `id = "profile"`
4. Second route is never evaluated

### 2. HTTP Method Specificity

Routes with different HTTP methods can coexist safely:

```typescript
app
  .get('/api/projects/{projectId}/files/{fileId}', getFileHandler)
  .put('/api/projects/{projectId}/files/{fileId}', updateFileHandler)
  .post('/api/projects/{projectId}/files/bulk', bulkCreateHandler)
  .put('/api/projects/{projectId}/files/bulk', bulkUpdateHandler)  // ❌ CONFLICT!
```

The conflict occurs because:

- `PUT /api/projects/123/files/bulk` matches `PUT /api/projects/{projectId}/files/{fileId}`
- `{fileId}` captures "bulk"
- Validation fails when trying to parse "bulk" as a number

## Common Route Conflict Patterns

### 1. Parameterized vs Literal Segments

```typescript
// ❌ WRONG ORDER - Specific routes after parameterized
app
  .get('/api/users/{userId}', getUserHandler)
  .get('/api/users/me', getCurrentUserHandler)        // Never reached
  .get('/api/users/settings', getUserSettingsHandler) // Never reached

// ✅ CORRECT ORDER - Specific routes before parameterized  
app
  .get('/api/users/me', getCurrentUserHandler)
  .get('/api/users/settings', getUserSettingsHandler)
  .get('/api/users/{userId}', getUserHandler)
```

### 2. Nested Resource Conflicts

```typescript
// ❌ PROBLEMATIC - General pattern before specific
app
  .put('/api/projects/{projectId}/files/{fileId}', updateFileHandler)
  .put('/api/projects/{projectId}/files/bulk', bulkUpdateHandler) // Conflict!

// ✅ FIXED - Specific patterns before general
app
  .put('/api/projects/{projectId}/files/bulk', bulkUpdateHandler)
  .put('/api/projects/{projectId}/files/{fileId}', updateFileHandler)
```

### 3. Query Parameter vs Path Parameter Confusion

```typescript
// These don't conflict (different methods), but show parameter handling
app
  .get('/api/search', searchHandler)           // Uses query params: ?q=term
  .get('/api/search/{term}', searchTermHandler) // Uses path params: /search/term
```

## Route Ordering Best Practices

### 1. Specificity Hierarchy

Order routes from most specific to least specific:

```typescript
export const apiRoutes = new OpenAPIHono()
  // 1. Exact literal paths (highest specificity)
  .get('/api/health', healthHandler)
  .get('/api/version', versionHandler)
  
  // 2. Literal segments with single parameter
  .get('/api/users/me', getCurrentUserHandler)
  .get('/api/users/settings', getSettingsHandler)
  
  // 3. Multiple literal segments with parameters
  .post('/api/projects/{projectId}/files/bulk', bulkCreateHandler)
  .put('/api/projects/{projectId}/files/bulk', bulkUpdateHandler)
  .get('/api/projects/{projectId}/files/search', searchFilesHandler)
  
  // 4. Single parameter routes (medium specificity)
  .get('/api/users/{userId}', getUserHandler)
  .get('/api/projects/{projectId}', getProjectHandler)
  
  // 5. Multiple parameter routes (lower specificity)
  .get('/api/projects/{projectId}/files/{fileId}', getFileHandler)
  .put('/api/projects/{projectId}/files/{fileId}', updateFileHandler)
  
  // 6. Catch-all or wildcard routes (lowest specificity)
  .get('/api/{resource}', genericResourceHandler)
  .all('*', notFoundHandler)
```

### 2. HTTP Method Grouping

Group routes by resource, ordered by HTTP method precedence:

```typescript
// Resource: Projects
app
  .post('/api/projects', createProjectHandler)           // CREATE
  .get('/api/projects', listProjectsHandler)             // READ (list)
  .get('/api/projects/{id}', getProjectHandler)          // READ (single)
  .put('/api/projects/{id}', updateProjectHandler)       // UPDATE
  .patch('/api/projects/{id}', patchProjectHandler)      // PARTIAL UPDATE
  .delete('/api/projects/{id}', deleteProjectHandler)    // DELETE
```

## Debugging Route Conflicts

### 1. Route Registration Analysis

```typescript
// Add logging to track route registration order
const routes: string[] = []

export const projectRoutes = new OpenAPIHono()
  .openapi(createRoute1, (c) => {
    routes.push('Route 1: POST /api/projects')
    return handler1(c)
  })
  .openapi(createRoute2, (c) => {
    routes.push('Route 2: PUT /api/projects/{id}/files/bulk')
    return handler2(c)
  })

console.log('Route registration order:', routes)
```

### 2. Request Matching Debugging

```typescript
// Middleware to log route matching
app.use('*', async (c, next) => {
  console.log(`Incoming: ${c.req.method} ${c.req.path}`)
  console.log('Params:', c.req.param())
  await next()
})
```

### 3. Validation Error Analysis

When you see validation errors like:

```json
{
  "error": {
    "issues": [{
      "code": "invalid_type",
      "expected": "number", 
      "received": "nan",
      "path": ["fileId"]
    }]
  }
}
```

This indicates:

- A literal string ("bulk") is being captured by a parameter (`{fileId}`)
- The parameter schema expects a number
- Route ordering issue: specific route should come before parameterized route

## Real-World Example: File Management API

### Problem Case

```typescript
// ❌ This causes conflicts
const routes = new OpenAPIHono()
  .put('/api/projects/{projectId}/files/{fileId}', updateFileHandler)
  .put('/api/projects/{projectId}/files/bulk', bulkUpdateHandler)
```

**Issue**: `PUT /api/projects/123/files/bulk` matches the first route with `fileId = "bulk"`

### Solution

```typescript
// ✅ Correct ordering
const routes = new OpenAPIHono()
  .put('/api/projects/{projectId}/files/bulk', bulkUpdateHandler)
  .put('/api/projects/{projectId}/files/{fileId}', updateFileHandler)
```

### Complete File API Example

```typescript
const fileRoutes = new OpenAPIHono()
  // Bulk operations (most specific)
  .post('/api/projects/{projectId}/files/bulk', bulkCreateFilesHandler)
  .put('/api/projects/{projectId}/files/bulk', bulkUpdateFilesHandler)
  .delete('/api/projects/{projectId}/files/bulk', bulkDeleteFilesHandler)
  
  // Search and filters (specific operations)
  .get('/api/projects/{projectId}/files/search', searchFilesHandler)
  .get('/api/projects/{projectId}/files/recent', getRecentFilesHandler)
  
  // List operations (medium specificity)
  .get('/api/projects/{projectId}/files', listFilesHandler)
  .post('/api/projects/{projectId}/files', createFileHandler)
  
  // Individual file operations (least specific)
  .get('/api/projects/{projectId}/files/{fileId}', getFileHandler)
  .put('/api/projects/{projectId}/files/{fileId}', updateFileHandler)
  .patch('/api/projects/{projectId}/files/{fileId}', patchFileHandler)
  .delete('/api/projects/{projectId}/files/{fileId}', deleteFileHandler)
```

## Schema Design for Route Parameters

### 1. Parameter Validation

```typescript
// Use appropriate parameter schemas
const FileIdParamsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  fileId: z.coerce.number().int().positive()
})

const ProjectIdParamsSchema = z.object({
  projectId: z.coerce.number().int().positive()
})
```

### 2. Body vs Parameter Distinction

```typescript
// ❌ Confusing: fileId in both params and body
const updateFileRoute = createRoute({
  path: '/api/files/{fileId}',
  request: {
    params: z.object({ fileId: z.number() }),
    body: z.object({ fileId: z.number(), content: z.string() })
  }
})

// ✅ Clear: fileId only in params, content in body
const updateFileRoute = createRoute({
  path: '/api/files/{fileId}',
  request: {
    params: z.object({ fileId: z.number() }),
    body: z.object({ content: z.string() })
  }
})
```

## Testing Route Conflicts

### 1. Unit Tests for Route Matching

```typescript
describe('Route Conflict Tests', () => {
  test('bulk operations should not conflict with parameterized routes', async () => {
    // Test that bulk endpoint is reached
    const bulkResponse = await app.request('/api/projects/123/files/bulk', {
      method: 'PUT',
      body: JSON.stringify({ updates: [{ fileId: 456, content: 'test' }] }),
      headers: { 'Content-Type': 'application/json' }
    })
    
    expect(bulkResponse.status).toBe(200)
    
    // Test that parameterized endpoint still works
    const fileResponse = await app.request('/api/projects/123/files/456', {
      method: 'PUT',
      body: JSON.stringify({ content: 'test' }),
      headers: { 'Content-Type': 'application/json' }
    })
    
    expect(fileResponse.status).toBe(200)
  })
})
```

### 2. Integration Tests

```typescript
test('route precedence integration test', async () => {
  const testCases = [
    { path: '/api/users/me', expectedHandler: 'getCurrentUser' },
    { path: '/api/users/settings', expectedHandler: 'getSettings' },
    { path: '/api/users/123', expectedHandler: 'getUser' },
    { path: '/api/projects/456/files/bulk', expectedHandler: 'bulkUpdate' },
    { path: '/api/projects/456/files/789', expectedHandler: 'updateFile' }
  ]
  
  for (const testCase of testCases) {
    const response = await app.request(testCase.path)
    // Verify correct handler was called based on response structure
    expect(response.headers.get('x-handler')).toBe(testCase.expectedHandler)
  }
})
```

## Performance Considerations

### 1. Route Tree Optimization

- Hono builds an internal route tree for efficient matching
- More specific routes early in registration = faster matching
- Avoid deeply nested parameter routes when possible

### 2. Route Count Impact

```typescript
// ❌ Too many similar routes
app
  .get('/api/v1/users/{id}', handler)
  .get('/api/v2/users/{id}', handler)
  .get('/api/v3/users/{id}', handler)

// ✅ Use versioning middleware or separate routers
const v1Router = new OpenAPIHono().get('/api/users/{id}', v1Handler)
const v2Router = new OpenAPIHono().get('/api/users/{id}', v2Handler)

app.route('/v1', v1Router)
app.route('/v2', v2Router)
```

## Common Pitfalls & Solutions

### 1. Case Sensitivity

```typescript
// Routes are case-sensitive
app.get('/api/Users/{id}', handler)  // Different from
app.get('/api/users/{id}', handler)  // this route
```

### 2. Trailing Slashes

```typescript
// These are different routes
app.get('/api/users', handler1)   // No trailing slash
app.get('/api/users/', handler2)  // With trailing slash

// Solution: Use middleware to normalize
app.use('*', async (c, next) => {
  if (c.req.path.endsWith('/') && c.req.path.length > 1) {
    return c.redirect(c.req.path.slice(0, -1))
  }
  await next()
})
```

### 3. Parameter Type Coercion

```typescript
// ❌ Can cause unexpected behavior
const schema = z.object({
  id: z.coerce.number()  // "abc" becomes NaN
})

// ✅ Explicit validation with better error messages
const schema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number)
})
```

## Conclusion

Route conflicts in Hono are primarily caused by incorrect registration order. The key principles are:

1. **Specificity First**: Register specific routes before parameterized ones
2. **Method Awareness**: Different HTTP methods don't conflict
3. **Parameter Validation**: Use appropriate schemas for route parameters
4. **Testing**: Verify route precedence with comprehensive tests
5. **Documentation**: Document route ordering decisions for team clarity

By following these practices, you can build robust APIs that handle routing predictably and avoid the frustrating debugging sessions that route conflicts can cause.
