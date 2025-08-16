# Promptliano Feature Development Guide

This guide provides a comprehensive overview of how to build features in Promptliano, following established patterns and best practices discovered through codebase analysis.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Feature Development Workflow](#feature-development-workflow)
3. [Key Patterns and Best Practices](#key-patterns-and-best-practices)
4. [Migration and Database Patterns](#migration-and-database-patterns)
5. [Development Tools and Agents](#development-tools-and-agents)
6. [Testing and Quality Assurance](#testing-and-quality-assurance)
7. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)

## Architecture Overview

Promptliano follows a monorepo structure with specialized packages that create a clear separation of concerns:

```
packages/
├── schemas/        # Zod schemas - Single source of truth
├── storage/        # SQLite database layer with migrations
├── services/       # Business logic and service layer
├── server/         # Hono API server with MCP tools
├── api-client/     # TypeScript API client
├── client/         # React frontend with Tanstack Router
├── shared/         # Shared utilities and types
└── config/         # Configuration management
```

### Data Flow Architecture

```
Zod Schemas (source of truth)
    ↓
Storage Layer (SQLite with Zod validation)
    ↓
Service Layer (business logic)
    ↓
API Routes (Hono + OpenAPI)
    ↓
MCP Tools (AI accessibility)
    ↓
API Client (type-safe client)
    ↓
React Hooks (Tanstack Query)
    ↓
UI Components (ShadCN)
```

### Core Principles

- **Single Source of Truth**: Zod schemas define all data structures
- **Type Safety**: End-to-end type safety from database to UI
- **DRY (Don't Repeat Yourself)**: Reusable components and shared logic
- **KISS (Keep It Simple)**: Simple solutions over complex ones
- **SRP (Single Responsibility)**: Each module has one clear purpose
- **Centralized API Client**: All API client code goes in `packages/api-client/api-client.ts` - no separate client files

## Feature Development Workflow

Here's the step-by-step process for building a new feature in Promptliano:

### Step 1: Design Zod Schemas

Create schemas in `packages/schemas/src/[feature].schemas.ts`:

```typescript
import { z } from '@hono/zod-openapi'
import { unixTSSchemaSpec } from './schema-utils'

// Base schema with all fields
export const FeatureSchema = z
  .object({
    id: unixTSSchemaSpec,
    projectId: unixTSSchemaSpec,
    name: z.string().min(1),
    description: z.string().default(''),
    status: z.enum(['active', 'inactive']).default('active'),
    metadata: z.array(z.string()).default([]), // Arrays stored as JSON
    created: unixTSSchemaSpec,
    updated: unixTSSchemaSpec
  })
  .openapi('Feature')

// Create/Update schemas (exclude computed fields)
export const CreateFeatureBodySchema = z
  .object({
    projectId: unixTSSchemaSpec,
    name: z.string().min(1),
    description: z.string().default(''),
    status: z.enum(['active', 'inactive']).default('active'),
    metadata: z.array(z.string()).optional()
  })
  .openapi('CreateFeatureBody')

// Type exports
export type Feature = z.infer<typeof FeatureSchema>
export type CreateFeatureBody = z.infer<typeof CreateFeatureBodySchema>

// API validation schemas
export const featureApiValidation = {
  create: {
    body: CreateFeatureBodySchema
  },
  update: {
    body: UpdateFeatureBodySchema,
    params: z.object({
      featureId: z.string()
    })
  }
}
```

### Step 2: Create Storage Layer

Implement storage in `packages/storage/src/[feature]-storage.ts`:

```typescript
import { z } from 'zod'
import { FeatureSchema, type Feature } from '@promptliano/schemas'
import { DatabaseManager, getDb } from './database-manager'
import { ApiError } from '@promptliano/shared'

const FEATURES_TABLE = 'features'

// Storage schema for validation
export const FeaturesStorageSchema = z.record(z.string(), FeatureSchema)
export type FeaturesStorage = z.infer<typeof FeaturesStorageSchema>

class FeatureStorage {
  private getDb(): DatabaseManager {
    return getDb()
  }

  async readFeatures(projectId: number): Promise<FeaturesStorage> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, project_id, name, description, status,
          metadata, created_at, updated_at
        FROM ${FEATURES_TABLE}
        WHERE project_id = ?
        ORDER BY created_at DESC
      `)

      const rows = query.all(projectId) as any[]
      const featuresStorage: FeaturesStorage = {}

      for (const row of rows) {
        const feature: Feature = {
          id: row.id,
          projectId: row.project_id,
          name: row.name,
          description: row.description,
          status: row.status,
          metadata: safeJsonParse(row.metadata, []),
          created: row.created_at,
          updated: row.updated_at
        }

        const validated = await validateData(feature, FeatureSchema, `feature ${feature.id}`)
        featuresStorage[String(validated.id)] = validated
      }

      return featuresStorage
    } catch (error: any) {
      throw new ApiError(500, `Failed to read features`, 'DB_READ_ERROR')
    }
  }

  generateFeatureId(): number {
    return this.getDb().generateUniqueId(FEATURES_TABLE)
  }
}

export const featureStorage = new FeatureStorage()
```

### Step 3: Create Database Migration

Add migration in `packages/storage/src/migrations/XXX-features.ts`:

```typescript
import type { Database } from 'bun:sqlite'

export const featuresMigration = {
  version: 15,
  description: 'Create features table with proper columns',

  up: (db: Database) => {
    db.exec(`
      CREATE TABLE features (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        metadata TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // Create indexes for performance
    db.exec(`CREATE INDEX idx_features_project_id ON features(project_id)`)
    db.exec(`CREATE INDEX idx_features_status ON features(status)`)
    db.exec(`CREATE INDEX idx_features_created_at ON features(created_at)`)
  },

  down: (db: Database) => {
    db.exec(`DROP TABLE IF EXISTS features`)
  }
}
```

### Step 4: Implement Service Layer

Create service in `packages/services/src/[feature]-service.ts`:

```typescript
import type { CreateFeatureBody, UpdateFeatureBody, Feature } from '@promptliano/schemas'
import { featureStorage } from '@promptliano/storage'
import { ApiError } from '@promptliano/shared'

export async function createFeature(data: CreateFeatureBody): Promise<Feature> {
  const featureId = featureStorage.generateFeatureId()
  const now = Date.now()

  const newFeature: Feature = {
    id: featureId,
    projectId: data.projectId,
    name: data.name,
    description: data.description || '',
    status: data.status || 'active',
    metadata: data.metadata || [],
    created: now,
    updated: now
  }

  return await featureStorage.addFeature(newFeature)
}

export async function getFeatureById(featureId: number): Promise<Feature> {
  const feature = await featureStorage.getFeatureById(featureId)
  if (!feature) {
    throw new ApiError(404, `Feature ${featureId} not found`, 'FEATURE_NOT_FOUND')
  }
  return feature
}

export async function listFeaturesByProject(projectId: number): Promise<Feature[]> {
  const featuresStorage = await featureStorage.readFeatures(projectId)
  return Object.values(featuresStorage).sort((a, b) => b.created - a.created)
}
```

### Step 5: Create API Routes

Implement routes in `packages/server/src/routes/[feature]-routes.ts`:

```typescript
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { FeatureSchema, featureApiValidation } from '@promptliano/schemas'
import { createFeature, getFeatureById, listFeaturesByProject } from '@promptliano/services'

const FeatureResponseSchema = z
  .object({
    success: z.literal(true),
    data: FeatureSchema
  })
  .openapi('FeatureResponse')

export const featureRouter = new OpenAPIHono()

// Create feature
const createFeatureRoute = createRoute({
  method: 'post',
  path: '/features',
  tags: ['Features'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: featureApiValidation.create.body
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: FeatureResponseSchema
        }
      }
    }
  }
})

featureRouter.openapi(createFeatureRoute, async (c) => {
  const data = c.req.valid('json')
  const feature = await createFeature(data)
  return c.json({ success: true, data: feature })
})

// List features by project
const listFeaturesRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/features',
  tags: ['Features'],
  request: {
    params: z.object({
      projectId: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(FeatureSchema)
          })
        }
      }
    }
  }
})

featureRouter.openapi(listFeaturesRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const features = await listFeaturesByProject(Number(projectId))
  return c.json({ success: true, data: features })
})
```

### Step 6: Create MCP Tool

Add MCP tool to `packages/server/src/mcp/consolidated-tools.ts`:

```typescript
// Add to imports
import { createFeature, getFeatureById, listFeaturesByProject } from '@promptliano/services'

// Add feature manager tool
const featureManagerTool: MCPToolDefinition = {
  name: 'feature_manager',
  description: 'Manage features. Actions: list, get, create, update, delete',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'create', 'update', 'delete'],
        description: 'The action to perform'
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for list, create)'
      },
      data: {
        type: 'object',
        description: 'Action-specific data'
      }
    },
    required: ['action']
  },
  handler: async (args: any): Promise<MCPToolResponse> => {
    const { action, projectId, data } = args

    switch (action) {
      case 'list':
        if (!projectId) throw createMCPError('projectId required', MCPErrorCode.INVALID_PARAMS)
        const features = await listFeaturesByProject(projectId)
        return { content: [{ type: 'text', text: JSON.stringify(features, null, 2) }] }

      case 'create':
        if (!projectId || !data) throw createMCPError('projectId and data required', MCPErrorCode.INVALID_PARAMS)
        const feature = await createFeature({ ...data, projectId })
        return { content: [{ type: 'text', text: `Created feature: ${JSON.stringify(feature, null, 2)}` }] }

      default:
        throw createMCPError(`Unknown action: ${action}`, MCPErrorCode.INVALID_PARAMS)
    }
  }
}
```

### Step 7: Update API Client

IMPORTANT: All API client code must be added to `packages/api-client/api-client.ts` as a service class extending BaseApiClient. Do NOT create separate files.

Add to `packages/api-client/api-client.ts`:

```typescript
// Add feature imports at the top with other imports
import type { CreateFeatureBody, UpdateFeatureBody, Feature } from '@promptliano/schemas'
import {
  FeatureResponseSchema,
  FeatureListResponseSchema,
  CreateFeatureBodySchema,
  UpdateFeatureBodySchema
} from '@promptliano/schemas'

// Add FeatureService class (before the PromptlianoClient class)
export class FeatureService extends BaseApiClient {
  async createFeature(data: CreateFeatureBody) {
    const validatedData = this.validateBody(CreateFeatureBodySchema, data)
    const result = await this.request('POST', '/features', {
      body: validatedData,
      responseSchema: FeatureResponseSchema
    })
    return result as DataResponseSchema<Feature>
  }

  async listFeatures(projectId: number) {
    const result = await this.request('GET', `/projects/${projectId}/features`, {
      responseSchema: FeatureListResponseSchema
    })
    return result as DataResponseSchema<Feature[]>
  }

  async getFeature(featureId: number) {
    const result = await this.request('GET', `/features/${featureId}`, {
      responseSchema: FeatureResponseSchema
    })
    return result as DataResponseSchema<Feature>
  }
}

// In PromptlianoClient class, add the property:
export class PromptlianoClient {
  // ... existing properties ...
  public readonly features: FeatureService

  constructor(config: ApiConfig) {
    // ... existing service initializations ...
    this.features = new FeatureService(config)
  }
}
```

### Step 8: Create React Hooks

Implement hooks in `packages/client/src/hooks/api/use-features-api.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateFeatureBody, Feature } from '@promptliano/schemas'
import { promptlianoClient } from '@/hooks/promptliano-client' // IMPORTANT: Always import from this location

// Query keys
export const FEATURE_KEYS = {
  all: ['features'] as const,
  lists: () => [...FEATURE_KEYS.all, 'list'] as const,
  list: (projectId: number) => [...FEATURE_KEYS.lists(), projectId] as const,
  details: () => [...FEATURE_KEYS.all, 'detail'] as const,
  detail: (featureId: number) => [...FEATURE_KEYS.details(), featureId] as const
}

// Queries
export function useGetFeatures(projectId: number) {
  return useQuery({
    queryKey: FEATURE_KEYS.list(projectId),
    queryFn: async () => {
      const response = await promptlianoClient.features.listFeatures(projectId)
      return response.data // IMPORTANT: Extract .data from DataResponseSchema
    },
    enabled: !!projectId,
    staleTime: 30 * 1000
  })
}

// Mutations
export function useCreateFeature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateFeatureBody) => {
      const response = await promptlianoClient.features.createFeature(data)
      return response.data // IMPORTANT: Extract .data from DataResponseSchema
    },
    onSuccess: (feature) => {
      // Invalidate project features list
      queryClient.invalidateQueries({
        queryKey: FEATURE_KEYS.list(feature.projectId)
      })
    }
  })
}

// Invalidation utilities
export function useInvalidateFeatures() {
  const queryClient = useQueryClient()

  return {
    invalidateAllFeatures: () => {
      queryClient.invalidateQueries({ queryKey: FEATURE_KEYS.all })
    },
    invalidateProjectFeatures: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: FEATURE_KEYS.list(projectId) })
    }
  }
}
```

### Step 9: Build UI Components

Create reusable components in `packages/client/src/components/features/`:

```typescript
// feature-list.tsx
import { type Feature } from '@promptliano/schemas'
import { Card, Badge } from '@ui'

interface FeatureListProps {
  features: Feature[]
  selectedFeature: Feature | null
  onSelectFeature: (feature: Feature) => void
}

export function FeatureList({ features, selectedFeature, onSelectFeature }: FeatureListProps) {
  return (
    <div className='space-y-2'>
      {features.map((feature) => (
        <Card
          key={feature.id}
          className={`p-4 cursor-pointer transition-colors ${
            selectedFeature?.id === feature.id ? 'bg-accent' : 'hover:bg-card/80'
          }`}
          onClick={() => onSelectFeature(feature)}
        >
          <div className='flex justify-between items-center'>
            <h3 className='font-semibold'>{feature.name}</h3>
            <Badge variant={feature.status === 'active' ? 'default' : 'secondary'}>
              {feature.status}
            </Badge>
          </div>
          {feature.description && (
            <p className='text-sm text-muted-foreground mt-2'>{feature.description}</p>
          )}
        </Card>
      ))}
    </div>
  )
}
```

### Step 10: Integrate into Pages

Use hooks and components at the page level:

```typescript
// In a page component
import { useGetFeatures, useCreateFeature } from '@/hooks/api/use-features-api'
import { FeatureList } from '@/components/features/feature-list'
import { CreateFeatureDialog } from '@/components/features/create-feature-dialog'

export function FeaturesPage({ projectId }: { projectId: number }) {
  const { data: features, isLoading } = useGetFeatures(projectId)
  const createFeatureMutation = useCreateFeature()
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)

  if (isLoading) return <div>Loading features...</div>

  return (
    <div className='grid grid-cols-3 gap-4'>
      <div className='col-span-1'>
        <FeatureList
          features={features || []}
          selectedFeature={selectedFeature}
          onSelectFeature={setSelectedFeature}
        />
      </div>
      <div className='col-span-2'>
        {selectedFeature ? (
          <FeatureDetail feature={selectedFeature} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}
```

### Step 11: Comprehensive Code Review (MANDATORY)

After completing all implementation steps, you MUST perform a comprehensive code review:

```bash
Task(
  description: "Review feature implementation",
  subagent_type: "staff-engineer-code-reviewer",
  prompt: "Review the complete [feature name] implementation including:
    - Zod schemas: packages/schemas/src/[feature].schemas.ts
    - Storage layer: packages/storage/src/[feature]-storage.ts
    - Database migration: packages/storage/src/migrations/XXX-[feature].ts
    - Service layer: packages/services/src/[feature]-service.ts
    - API routes: packages/server/src/routes/[feature]-routes.ts
    - MCP tool updates: packages/server/src/mcp/consolidated-tools.ts
    - API client: packages/api-client/api-client.ts
    - React hooks: packages/client/src/hooks/api/use-[feature]-api.ts
    - UI components: packages/client/src/components/[feature]/
    - Page integration: [relevant page files]

    Validate:
    - Security best practices
    - Performance optimization
    - Error handling coverage
    - Type safety throughout
    - Pattern consistency
    - Test coverage needs"
)
```

The code review is not optional - it's a critical quality gate that ensures your feature meets Promptliano's standards for security, performance, and maintainability.

### Step 12: Address Review Feedback

Based on the code review results:

1. **Fix Critical Issues First**: Security vulnerabilities, data integrity issues
2. **Optimize Performance**: Address query inefficiencies, caching problems
3. **Improve Code Quality**: Fix DRY violations, enhance readability
4. **Add Missing Tests**: Implement suggested test cases
5. **Document Complex Logic**: Add comments where recommended

After addressing significant feedback, request a follow-up review to ensure all issues are resolved.

## Key Patterns and Best Practices

### 1. Unix Timestamp IDs

Always use Unix timestamp-based IDs generated by `generateUniqueId()`:

```typescript
const featureId = featureStorage.generateFeatureId()
```

### 2. Column-Based Storage

Store data in proper database columns, not JSON blobs:

```sql
-- Good: Direct columns with proper types
CREATE TABLE features (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive'))
)

-- Bad: JSON blob storage
CREATE TABLE features (
  id TEXT PRIMARY KEY,
  data JSON NOT NULL
)
```

### 3. Safe JSON Parsing

Always use safe parsing for JSON array fields:

```typescript
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

// Usage
metadata: safeJsonParse(row.metadata, [])
```

### 4. Transaction Management

Use transactions for atomic operations:

```typescript
database.transaction(() => {
  // Delete old data
  deleteQuery.run(projectId)

  // Insert new data
  for (const item of items) {
    insertQuery.run(item.id, item.name)
  }
})()
```

### 5. Error Handling

Use ApiError for consistent error responses:

```typescript
import { ApiError } from '@promptliano/shared'

if (!feature) {
  throw new ApiError(404, 'Feature not found', 'FEATURE_NOT_FOUND')
}
```

### 6. Type Inference

Always infer types from Zod schemas:

```typescript
// Good: Infer from schema
export type Feature = z.infer<typeof FeatureSchema>

// Bad: Manual type definition
export interface Feature {
  id: number
  name: string
  // ...
}
```

### 7. Query Key Patterns

Use consistent query key patterns for cache management:

```typescript
export const FEATURE_KEYS = {
  all: ['features'] as const,
  lists: () => [...FEATURE_KEYS.all, 'list'] as const,
  list: (projectId: number) => [...FEATURE_KEYS.lists(), projectId] as const,
  detail: (featureId: number) => [...FEATURE_KEYS.all, 'detail', featureId] as const
}
```

### 8. Component Composition

Prefer composition over one-off components:

```typescript
// Good: Reusable components
<Card>
  <CardHeader>
    <CardTitle>{feature.name}</CardTitle>
  </CardHeader>
  <CardContent>
    <Badge>{feature.status}</Badge>
  </CardContent>
</Card>

// Bad: One-off component
<div className="custom-feature-card">
  {/* Custom implementation */}
</div>
```

## Migration and Database Patterns

### Migration Structure

1. **Version Number**: Sequential integers
2. **Description**: Clear description of changes
3. **Up/Down Methods**: Forward and rollback operations
4. **Indexes**: Always create indexes for foreign keys and commonly queried fields

```typescript
export const migration = {
  version: 15,
  description: 'Create features table',

  up: (db: Database) => {
    // Create tables
    // Create indexes
    // Add constraints
  },

  down: (db: Database) => {
    // Reverse operations
  }
}
```

### Column Design Principles

1. **Use NOT NULL with defaults** where appropriate
2. **Store arrays as TEXT with '[]' default**
3. **Use CHECK constraints** for enums
4. **Add foreign key constraints** with CASCADE
5. **Create comprehensive indexes**

### Performance Considerations

1. **Direct column queries** are 10-100x faster than JSON extraction
2. **Index foreign keys** for JOIN performance
3. **Use compound indexes** for common query patterns
4. **Avoid N+1 queries** by fetching related data efficiently

## Development Tools and Agents

### Specialized Agents

Promptliano includes specialized AI agents for different aspects of development:

1. **zod-schema-architect**: Creates and optimizes Zod schemas
2. **promptliano-service-architect**: Designs service layer implementations
3. **promptliano-sqlite-expert**: Handles database migrations
4. **hono-bun-api-architect**: Creates API endpoints
5. **promptliano-ui-architect**: Builds React UI components
6. **promptliano-mcp-tool-creator**: Creates MCP tools
7. **staff-engineer-code-reviewer**: Reviews implementation quality
8. **code-modularization-expert**: Refactors and simplifies code
9. **promptliano-planning-architect**: Plans features with tickets/tasks

### Using Agents Effectively

1. **Plan First**: Use promptliano-planning-architect to break down features
2. **Parallel Development**: Launch multiple agents for different layers
3. **Schema as Source**: Start with zod-schema-architect for data design
4. **Review Always**: Use staff-engineer-code-reviewer after implementation

### Code Review with staff-engineer-code-reviewer

After implementing any feature, it's **mandatory** to use the `staff-engineer-code-reviewer` agent for a comprehensive code review. This agent performs deep analysis and validates your implementation.

#### When to Use Code Review

- **After Feature Implementation**: Always after completing a new feature
- **After Refactoring**: When you've made significant changes to existing code
- **After Bug Fixes**: To ensure the fix doesn't introduce new issues
- **Before Merging**: As a final check before creating pull requests

#### How to Use the Code Review Agent

```bash
# Example: Review a newly implemented authentication feature
Task(
  description: "Review authentication implementation",
  subagent_type: "staff-engineer-code-reviewer",
  prompt: "Review the authentication feature I just implemented. Check the following files:
    - packages/schemas/src/auth.schemas.ts
    - packages/storage/src/auth-storage.ts
    - packages/services/src/auth-service.ts
    - packages/server/src/routes/auth-routes.ts
    - packages/client/src/hooks/api/use-auth-api.ts
    - packages/client/src/components/auth/

    Focus on:
    1. Security vulnerabilities
    2. Performance issues
    3. Code quality and maintainability
    4. Adherence to project patterns
    5. Error handling completeness"
)
```

#### What the Code Reviewer Checks

1. **Security Analysis**
   - SQL injection vulnerabilities
   - XSS attack vectors
   - Authentication/authorization flaws
   - Sensitive data exposure
   - Input validation gaps

2. **Performance Review**
   - Database query efficiency
   - N+1 query problems
   - Unnecessary re-renders in React
   - Bundle size impact
   - Cache invalidation efficiency

3. **Code Quality**
   - DRY principle violations
   - SOLID principle adherence
   - Type safety issues
   - Error handling completeness
   - Code readability and maintainability

4. **Pattern Compliance**
   - Follows Promptliano conventions
   - Uses established patterns correctly
   - Proper package dependencies
   - Consistent naming conventions

5. **Testing Coverage**
   - Missing test cases
   - Edge case handling
   - Error scenario coverage
   - Integration test needs

#### Acting on Review Feedback

When the code reviewer provides feedback:

1. **Critical Issues**: Fix immediately before proceeding
2. **Performance Concerns**: Optimize based on suggestions
3. **Pattern Violations**: Refactor to match project standards
4. **Security Vulnerabilities**: Address all security issues
5. **Improvement Suggestions**: Consider implementing for better code quality

#### Example Review Workflow

```typescript
// Step 1: Implement your feature
// ... complete all 10 steps of feature development ...

// Step 2: Request comprehensive review
// The agent will analyze all aspects of your implementation

// Step 3: Review feedback might look like:
/*
SECURITY ISSUES:
- auth-service.ts:45 - Password comparison vulnerable to timing attacks
  Suggestion: Use bcrypt.compare() instead of direct comparison

PERFORMANCE CONCERNS:
- auth-routes.ts:78 - N+1 query problem when fetching user permissions
  Suggestion: Use JOIN or batch fetch permissions

CODE QUALITY:
- auth-storage.ts:120 - Duplicate logic found in lines 120-145 and 200-225
  Suggestion: Extract to shared function validateUserCredentials()

PATTERN VIOLATIONS:
- use-auth-api.ts:34 - Missing invalidation for user profile updates
  Suggestion: Add invalidateQueries for AUTH_KEYS.profile after mutation
*/

// Step 4: Address all issues
// Fix security vulnerabilities first, then performance, then code quality

// Step 5: Request follow-up review if significant changes were made
```

#### Integration with Other Agents

The code review process works best when combined with other agents:

```bash
# After code review suggests modularization
Task(
  description: "Modularize authentication service",
  subagent_type: "code-modularization-expert",
  prompt: "The code review identified duplicate logic in auth-storage.ts.
           Please modularize this file following the suggestions."
)

# If review identifies missing tests
Task(
  description: "Add missing test coverage",
  subagent_type: "general-purpose",
  prompt: "Add test cases for the edge cases identified in the code review:
           - Invalid token format handling
           - Expired session cleanup
           - Concurrent login attempts"
)
```

#### Best Practices for Code Review

1. **Be Specific**: Provide context about what you implemented
2. **Include All Files**: List all files that were created or modified
3. **Highlight Concerns**: Mention any areas you're unsure about
4. **Iterative Process**: Don't hesitate to request multiple reviews
5. **Learn from Feedback**: Use reviews to improve your coding patterns

### Promptliano MCP Integration

Use MCP tools for rapid development:

```bash
# Get project overview
mcp__promptliano__project_manager(action: "overview", projectId: 1754713756748)

# Suggest files for a feature
mcp__promptliano__project_manager(action: "suggest_files", projectId: 1754713756748, data: { prompt: "authentication" })

# Create tickets and tasks
mcp__promptliano__ticket_manager(action: "create", projectId: 1754713756748, data: { title: "Implement user profiles" })
```

## Testing and Quality Assurance

### Testing Strategy

1. **Unit Tests**: Test pure functions in isolation
2. **Integration Tests**: Test service layer with real database
3. **API Tests**: Test routes with supertest
4. **Component Tests**: Test React components with Testing Library

### Code Quality Checklist

- [ ] All data validated with Zod schemas
- [ ] Proper error handling with ApiError
- [ ] Database operations wrapped in transactions
- [ ] Indexes created for performance
- [ ] React Query invalidations implemented
- [ ] Components follow composition patterns
- [ ] **Code reviewed by staff-engineer-code-reviewer** (MANDATORY)
- [ ] Complex files modularized if needed
- [ ] Security vulnerabilities addressed from code review
- [ ] Performance issues resolved from code review
- [ ] All code review feedback implemented

### Performance Validation

1. **Query Performance**: Check EXPLAIN QUERY PLAN
2. **Bundle Size**: Monitor frontend bundle growth
3. **API Response Time**: Track endpoint performance
4. **Cache Hit Rate**: Monitor React Query cache effectiveness

## Common Pitfalls and Solutions

### 1. JSON Blob Storage

**Problem**: Storing everything as JSON makes queries slow and complex

**Solution**: Use proper columns with appropriate types and indexes

### 2. Missing Transactions

**Problem**: Partial updates when operations fail

**Solution**: Wrap related operations in database transactions

### 3. Manual Type Definitions

**Problem**: Types drift from runtime validation

**Solution**: Always use `z.infer<typeof Schema>` for types

### 4. Forgetting Invalidations

**Problem**: Stale data in React Query cache

**Solution**: Implement comprehensive invalidation strategies

### 5. One-Off Components

**Problem**: Duplicate UI code across features

**Solution**: Use ShadCN primitives and composition

### 6. Missing Indexes

**Problem**: Slow queries on large tables

**Solution**: Index foreign keys and commonly queried fields

### 7. Improper Error Handling

**Problem**: Generic error messages to users

**Solution**: Use ApiError with specific error codes

### 8. Circular Dependencies

**Problem**: Import cycles between packages

**Solution**: Follow the established package hierarchy

## Conclusion

Building features in Promptliano follows a predictable, type-safe pattern from database to UI. By following this guide and leveraging the specialized agents, you can build robust features that integrate seamlessly with the existing codebase.

Remember:

- Start with Zod schemas as your source of truth
- Use specialized agents for parallel development
- Follow established patterns for consistency
- **ALWAYS perform comprehensive code review with staff-engineer-code-reviewer**
- Address all review feedback before considering the feature complete
- Keep it simple and modular

The code review step is not optional - it's your quality gate that ensures:

- Security vulnerabilities are caught early
- Performance issues are identified and fixed
- Code quality meets Promptliano standards
- Patterns are consistently followed
- Your feature integrates seamlessly with the existing codebase

Happy coding! 🚀
