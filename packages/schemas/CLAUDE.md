# Zod Schema Architecture Guide

The `@promptliano/schemas` package is the foundation of type safety and data validation across the entire Promptliano ecosystem. This package contains 600+ schema definitions organized by domain, with comprehensive OpenAPI integration and sophisticated validation patterns.

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze implementation quality and suggest improvements
   - Ensure proper schema composition, validation patterns, and type inference

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on schema composition and reusability

3. **Package-Specific Agents**
   - Use `zod-schema-architect` for schema design and validation patterns
   - Use `hono-bun-api-architect` when schemas integrate with API routes
   - Use `promptliano-sqlite-expert` when schemas affect database structure

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about what was implemented/changed
- Use multiple agents concurrently for maximum efficiency
- Include OpenAPI metadata for all new schemas

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Define data structure (source of truth) (this package)
2. **Storage layer** - Create tables with validation
3. **Services** - Implement business logic
4. **MCP tools** - Enable AI access
5. **API routes** - Create endpoints with OpenAPI
6. **API client** - Add to single api-client.ts file
7. **React hooks** - Setup with TanStack Query
8. **UI components** - Build with shadcn/ui
9. **Page integration** - Wire everything together
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package handles step 1: Defining Zod schemas as the single source of truth for all data structures across the application.

See main `/CLAUDE.md` for complete flow documentation.

## Architecture Overview

### Core Principles

1. **Schema-First Design**: All data structures start with Zod schemas as the single source of truth
2. **OpenAPI Integration**: Every schema includes `.openapi()` metadata for automatic API documentation
3. **Unified Validation**: Common validation utilities shared across domains
4. **Type Safety**: Full TypeScript type inference from schemas
5. **Domain Organization**: Schemas organized by business domain for maintainability

### Package Structure

```
src/
├── common.schemas.ts           # Common response/error schemas
├── schema-utils.ts             # Reusable validation utilities
├── unix-ts-utils.ts           # Timestamp handling utilities
├── global-state-schema.ts     # Client state management schemas
├── project.schemas.ts         # Project & file management
├── ticket.schemas.ts          # Ticket & task management
├── chat.schemas.ts            # Chat & message handling
├── queue.schemas.ts           # Task queue system
├── gen-ai.schemas.ts          # AI model configuration
├── provider-key.schemas.ts    # API provider management
├── mcp.schemas.ts             # MCP protocol integration
└── constants/                 # Schema constants
```

## Core Schema Patterns

### 1. Entity Schema Pattern

All domain entities follow a consistent structure:

```typescript
// Base entity with common fields
export const EntitySchema = z
  .object({
    id: entityIdSchema, // Consistent ID validation
    created: unixTSSchemaSpec, // Unix timestamp with preprocessing
    updated: unixTSSchemaSpec // Updated timestamp
    // ... domain-specific fields
  })
  .openapi('EntityName')

// Type inference - ALWAYS use z.infer, never manual types
export type Entity = z.infer<typeof EntitySchema>
```

### 2. Request/Response Pattern

API schemas follow REST conventions:

```typescript
// Request body schema
export const CreateEntityBodySchema = z
  .object({
    name: z.string().min(1)
    // ... required fields for creation
  })
  .openapi('CreateEntityBody')

// Response schemas
export const EntityResponseSchema = z
  .object({
    success: z.literal(true),
    data: EntitySchema
  })
  .openapi('EntityResponse')

export const EntityListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(EntitySchema)
  })
  .openapi('EntityListResponse')
```

### 3. Validation Group Pattern

Related validation schemas are grouped together:

```typescript
export const entityApiValidation = {
  create: {
    body: CreateEntityBodySchema
  },
  update: {
    body: UpdateEntityBodySchema,
    params: z.object({
      entityId: z.string()
    })
  },
  getOrDelete: {
    params: z.object({
      entityId: z.string()
    })
  }
}
```

## Schema Composition Techniques

### 1. Schema Extension

Use `.extend()` for adding fields to existing schemas:

```typescript
export const ExtendedEntitySchema = EntitySchema.extend({
  additionalField: z.string().optional(),
  complexField: z.object({
    nested: z.string()
  })
}).openapi('ExtendedEntity')
```

### 2. Schema Picking/Omitting

Create variations by selecting or excluding fields:

```typescript
// Without sensitive data
export const PublicEntitySchema = EntitySchema.omit({
  internalField: true
}).openapi('PublicEntity')

// Only specific fields
export const EntitySummarySchema = EntitySchema.pick({
  id: true,
  name: true,
  created: true
}).openapi('EntitySummary')
```

### 3. Schema Merging

Combine schemas from different domains:

```typescript
export const EnhancedEntitySchema = EntitySchema.merge(AuditSchema).openapi('EnhancedEntity')
```

### 4. Conditional Validation

Use `.refine()` for complex validation logic:

```typescript
export const ConditionalSchema = z
  .object({
    type: z.enum(['A', 'B']),
    valueA: z.string().optional(),
    valueB: z.number().optional()
  })
  .refine(
    (data) => {
      if (data.type === 'A') return data.valueA !== undefined
      if (data.type === 'B') return data.valueB !== undefined
      return false
    },
    {
      message: 'Value must match the specified type'
    }
  )
  .openapi('ConditionalData')
```

## Validation Utilities

### 1. ID and Timestamp Schemas

The package provides sophisticated ID and timestamp handling:

```typescript
// Entity IDs (positive integers)
entityIdSchema // Required entity ID
entityIdOptionalSchema // Optional entity ID
entityIdCoercibleSchema // Coerces strings to numbers (for URL params)
entityIdArraySchema // Array of entity IDs

// Unix timestamps with preprocessing
unixTSSchemaSpec // Required timestamp
unixTSOptionalSchemaSpec // Optional timestamp
unixTSArraySchemaSpec // Array of timestamps

// Special ID schemas (can accept -1 as null)
idSchemaSpec // Accepts -1 or valid timestamp
idArraySchemaSpec // Array of IDs with -1 support
```

### 2. Timestamp Preprocessing

The `unixTimestampSchema` automatically handles multiple input formats:

```typescript
// Accepts all these formats:
const inputs = [
  1716537600000, // Milliseconds timestamp
  1716537600, // Seconds timestamp (auto-converted)
  '2024-05-24T10:00:00Z', // ISO string
  '1716537600000', // Timestamp string
  new Date() // Date object
]

// All resolve to consistent millisecond timestamp
```

### 3. OpenAPI Integration

Every schema includes comprehensive OpenAPI metadata:

```typescript
export const ExampleSchema = z
  .object({
    id: entityIdSchema,
    name: z.string().min(1).openapi({
      example: 'My Example',
      description: 'The name of the example'
    }),
    optional: z.string().optional().openapi({
      example: 'Optional value',
      description: 'An optional field'
    })
  })
  .openapi('Example')
```

## Domain-Specific Schemas

### 1. Project Management

Project schemas handle file management, imports/exports, and statistics:

```typescript
// Core project entity
export const ProjectSchema = z
  .object({
    id: entityIdSchema,
    name: z.string(),
    path: z.string()
    // ... other fields
  })
  .openapi('Project')

// File with import/export analysis
export const ProjectFileSchema = z
  .object({
    // ... base fields
    imports: z.array(ImportInfoSchema).nullable(),
    exports: z.array(ExportInfoSchema).nullable()
    // ... other fields
  })
  .openapi('ProjectFile')
```

### 2. Ticket System with Queue Integration

Tickets and tasks include queue system integration:

```typescript
export const TicketSchema = z
  .object({
    // ... base fields
    queueId: entityIdNullableOptionalSchema,
    queueStatus: z.enum(['queued', 'in_progress', 'completed', 'failed', 'cancelled']).nullable().optional(),
    queuePriority: z.number().default(0).optional()
    // ... other queue fields
  })
  .openapi('Ticket')
```

### 3. AI Configuration

AI schemas handle model configuration and provider settings:

```typescript
export const AiSdkOptionsSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
    // Provider-specific overrides
    ollamaUrl: z.string().url().optional(),
    lmstudioUrl: z.string().url().optional()
  })
  .openapi('AiSdkOptions')
```

## Type Safety Patterns

### 1. Type Inference (CRITICAL)

**ALWAYS export inferred types using `z.infer<typeof Schema>` pattern. NEVER manually define types.**

```typescript
// CORRECT - Always use z.infer
export const MySchema = z
  .object({
    field: z.string()
  })
  .openapi('MyData')

export type MyData = z.infer<typeof MySchema>

// WRONG - Never manually define types
// export type MyData = {
//   field: string
// }
```

**Why this matters:**

- Ensures type safety and consistency
- Single source of truth (the schema)
- Automatic type updates when schema changes
- Prevents type drift and maintenance issues

### 2. Generic Type Utilities

Use conditional types for schema variations:

```typescript
export type WithoutContent<T> = T extends { content: any } ? Omit<T, 'content'> : T

export type ProjectFileWithoutContent = z.infer<typeof ProjectFileWithoutContentSchema>
```

### 3. Schema Maps

Use schema maps for dynamic key-value structures:

```typescript
export const ProjectFileMapSchema = z
  .map(z.number(), ProjectFileSchema)
  .describe('A map where keys are ProjectFile IDs')
  .openapi('ProjectFileMap')
```

## Testing Schemas

### 1. Comprehensive Test Coverage

Test schemas with multiple scenarios:

```typescript
describe('MySchema', () => {
  it('should validate valid data', () => {
    const validData = { field: 'value' }
    expect(() => MySchema.parse(validData)).not.toThrow()
  })

  it('should reject invalid data', () => {
    const invalidData = { field: 123 }
    expect(() => MySchema.parse(invalidData)).toThrow()
  })

  it('should handle default values', () => {
    const result = MySchema.parse({})
    expect(result.optionalField).toBe('default')
  })

  it('should have correct type inference', () => {
    const result = MySchema.parse({ field: 'value' })
    expect(typeof result.field).toBe('string')
  })
})
```

### 2. Integration Testing

Test schema integration with default values:

```typescript
it('should integrate with global state', () => {
  const globalState = {
    appSettings: KVDefaultValues.appSettings,
    projectTabs: KVDefaultValues.projectTabs
    // ... other fields
  }

  expect(() => globalStateSchema.parse(globalState)).not.toThrow()
})
```

### 3. Error Message Testing

Test validation error messages:

```typescript
it('should provide helpful error messages', () => {
  try {
    MySchema.parse({ field: null })
  } catch (error) {
    expect(error.issues[0].message).toContain('expected string')
  }
})
```

## Integration with Services

### 1. Service Layer Validation

Services use schemas for input/output validation:

```typescript
// In service methods
export async function createEntity(data: CreateEntityBody): Promise<Entity> {
  // Input is already validated by schema
  const entity = await repository.create(data)

  // Output validation ensures type safety
  return EntitySchema.parse(entity)
}
```

### 2. API Route Integration

Hono routes use schemas for automatic validation:

```typescript
app.post('/entities', zValidator('json', CreateEntityBodySchema), async (c) => {
  const body = c.req.valid('json') // Fully typed
  const result = await entityService.create(body)
  return c.json(
    EntityResponseSchema.parse({
      success: true,
      data: result
    })
  )
})
```

### 3. Form Validation

Client forms use schemas for validation:

```typescript
const form = useForm<CreateEntityBody>({
  resolver: zodResolver(CreateEntityBodySchema),
  defaultValues: {
    name: ''
    // ... other defaults
  }
})
```

## Best Practices

### 1. Schema Creation

- **Start with the domain model**: Define core entities first
- **Use composition**: Build complex schemas from simple ones
- **Include OpenAPI metadata**: Every schema needs `.openapi()`
- **Export types**: Always export inferred types
- **Validate defaults**: Ensure default values pass schema validation

### 2. Validation Strategy

- **Fail fast**: Use strict validation at boundaries
- **Provide defaults**: Use `.default()` for optional fields with sensible defaults
- **Clear error messages**: Use custom messages with `.refine()`
- **Preprocessing**: Use `.preprocess()` for data transformation

### 3. Testing Approach

- **Test valid cases**: Ensure schemas accept valid data
- **Test invalid cases**: Ensure schemas reject invalid data
- **Test edge cases**: Handle null, undefined, empty values
- **Test integration**: Verify schemas work with services and API routes
- **Test type inference**: Ensure TypeScript types are correct

### 4. Performance Considerations

- **Schema caching**: Zod schemas are immutable and cacheable
- **Lazy evaluation**: Use `.lazy()` for recursive schemas
- **Selective parsing**: Use `.pick()` and `.omit()` to reduce validation overhead
- **Error handling**: Use `.safeParse()` when errors are expected

## Common Patterns

### 1. Audit Fields Pattern

```typescript
export const AuditFieldsSchema = z.object({
  created: unixTSSchemaSpec,
  updated: unixTSSchemaSpec,
  createdBy: z.string().optional(),
  updatedBy: z.string().optional()
})

// Apply to any entity
export const EntityWithAuditSchema = EntitySchema.merge(AuditFieldsSchema)
```

### 2. Pagination Pattern

```typescript
export const PaginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc')
  })
  .openapi('PaginationQuery')
```

### 3. Search Pattern

```typescript
export const SearchQuerySchema = z
  .object({
    q: z.string().min(1),
    filters: z.record(z.string()).optional(),
    includeDeleted: z.boolean().default(false)
  })
  .openapi('SearchQuery')
```

## Migration and Evolution

### 1. Schema Versioning

When schemas need breaking changes:

```typescript
// v1 schema
export const EntityV1Schema = z.object({
  oldField: z.string()
})

// v2 schema with migration
export const EntityV2Schema = z.object({
  newField: z.string()
})

// Migration function
export function migrateEntityV1ToV2(v1: EntityV1): EntityV2 {
  return {
    newField: v1.oldField
  }
}
```

### 2. Backward Compatibility

Use optional fields and defaults for non-breaking changes:

```typescript
export const EntitySchema = z.object({
  existingField: z.string(),
  newField: z.string().optional().default('default-value')
})
```

### 3. Deprecation Pattern

Mark deprecated fields while maintaining compatibility:

```typescript
export const EntitySchema = z.object({
  newField: z.string(),
  oldField: z.string().optional().describe('DEPRECATED: Use newField instead')
})
```

This schema architecture ensures type safety, maintainability, and seamless integration across the entire Promptliano ecosystem while providing excellent developer experience through comprehensive validation and clear error messages.
