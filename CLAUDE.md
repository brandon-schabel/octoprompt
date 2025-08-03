# CLAUDE.md

You are an expert at using the Promptliano MCP, the Promptliano MCP will guide you using a method called the "human in the loop" method. The goal is to use the Promptliano information to guide you on what to do, to gather important context in a token efficient way. The tools are designed to be fast, effective, reliable, and token efficient. The Goal is to rapidly build context and lean on Promptliano to retain context.

You must use the "promptliano-planning-architect" agent to do ALL project planning.

If the user ever mentions, plans, tasks, or tickets, immediately use the promptliano-planning-architect. You should enter into a planning mode and create tickets in promptliano because each task contains suggsted prompts, files, and agent. The agent context should be inserted, then prompts, files, and then that help guide the AI much better based on the current task.

For full features load into context ./CLAUDE_CODE_PROMPTLIANO_FEATURE_DEVELOPMENT.md, this provides a very detailed guide on how to properly build features in promtliano

- Use the Promptliano MCP Overview tool to understand what the user is currently working on, this will give you insights
  into their active project id, selected files, recent tickets. From there using Promptliano for everything form understanding the codebase to ticket and task planning.
- Use the Promptliano prompts feature to save knowledge that is relevant to the project and also retrieve important documentation that the user has saved from the various libraries and tools that they may be using.
- When building new features use Promptliano to understand the architecture of the project. try to follow the patterns that the project is already using.
- Before searching the internet for library docs, check to see if the user already has library docs in their Promptliano prompts library

## Ports

Dev Server: 3147
Prod Server: 3579
Client Dev Server: 1420
Generally a fullstack feature consists of the follow

- Zod data schemas
- Data storage and table definitions for SQLite with zod validations
- Services using the zod schemas as the source of truth
- Create MCP tools so AIs can use the new service
- Feature routes with zod + hono openAPI integration
- Add routes to api-client (IMPORTANT: All API client code should be added to packages/api-client/api-client.ts as a service class extending BaseApiClient, following the pattern of existing services like ChatService, ProjectService, etc. Do NOT create separate client files)
- Setup data hook using react tanstack query that consume the api-client and add data invalidations where it makes sense (React hooks go in packages/client/src/hooks/api/ and should import promptlianoClient from '@/hooks/promptliano-client')
- Explorer if there are current components that meet current uses cases, if not add ShadCN components or compose new components based on the foundations of the primitive componets in the repo
- Integrate components and data hooks into a page to complete the feature

## Database Schema Migration Guidelines

When creating new entities or modifying existing database schemas, follow the migration patterns established in the project. The codebase is transitioning from JSON blob storage to proper SQLite column-based tables for better performance and type safety.

### Migration Documentation

Refer to these documentation files when working with database schemas:

- **`docs/migration-guide-json-to-columns.md`** - Complete guide for migrating from JSON to columns
- **`docs/entities-migration-analysis.md`** - Analysis of all entities and their proposed schemas
- **`docs/migration-templates/`** - Ready-to-use migration templates
- **`docs/migration-best-practices-and-pitfalls.md`** - Best practices and common issues

### Key Migration Principles

1. **Use proper columns instead of JSON blobs** - Direct queries are 10-100x faster
2. **Store JSON arrays as TEXT with NOT NULL DEFAULT '[]'** - Prevents parsing errors
3. **Add comprehensive indexes** - Always index foreign keys and query fields
4. **Use transactions for migrations** - Ensures atomic operations
5. **Follow the established patterns from tickets/tasks migration** (migrations 006 and 007)

### When Creating New Entities

1. Design the schema with proper columns (avoid storing everything as JSON)
2. Use the migration templates in `docs/migration-templates/`
3. Add NOT NULL constraints with appropriate defaults
4. Create indexes for all foreign keys and commonly queried fields
5. Implement safe JSON parsing for array/object fields using the `safeJsonParse` helper
6. Update the storage layer to use direct SQL queries instead of JSON_EXTRACT

### Selected Files Path-Based Migration

The selected files feature has been migrated from ID-based to path-based tracking to solve the issue where file IDs change when files are updated:

- **Migration Plan**: `docs/selected-files-path-migration-plan.md` - Complete migration strategy
- **Implementation Guide**: `docs/selected-files-implementation-guide.md` - Ready-to-use code examples
- **Component Analysis**: `docs/selected-files-components-analysis.md` - All affected components

Key points:

- File paths are stable identifiers (unique per project)
- The system now stores both `selectedFiles` (IDs) and `selectedFilePaths` for compatibility
- UI components should prefer path-based selection when available
- Migration maintains backward compatibility during transition

## File Suggestions Feature

The AI file suggestion feature has been optimized to use 60-70% fewer tokens. Three MCP methods are available:

### 1. Project-Level Suggestions (General Discovery)

Use when exploring files based on a text prompt:

```
mcp__Promptliano__project_manager(
  action: "suggest_files",
  projectId: 1750564533014,
  data: {
    prompt: "authentication flow",
    limit: 10
  }
)
```

### 2. Ticket-Level Suggestions (Optimized with Strategies)

Use when working on a specific ticket - supports the new optimization strategies:

```
mcp__Promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 456,
  data: {
    strategy: "balanced",     // "fast" | "balanced" | "thorough"
    maxResults: 10,
    extraUserInput: "focus on authentication components"
  }
)
```

### 3. Task-Level Suggestions

Use when working on a specific task within a ticket:

```
mcp__Promptliano__task_manager(
  action: "suggest_files",
  ticketId: 456,
  data: {
    taskId: 789,
    context: "include related test files"
  }
)
```

### Strategies (Ticket-Level Only)

- **`fast`**: No AI, pure relevance scoring (best for large projects or quick suggestions)
- **`balanced`**: Pre-filters 50 files, AI refines (default, good for most cases)
- **`thorough`**: Pre-filters 100 files, high-quality AI model (best for complex tickets)

### When to Use Each Method

- **Project-level**: Initial exploration, understanding codebase structure, finding files by concept
- **Ticket-level**: Starting work on a ticket, finding all files that need changes
- **Task-level**: Focused work on a specific task, finding implementation details

### Tips

- Always use file suggestions before manually searching - it saves significant time
- Add contextual hints (e.g., "include test files", "focus on API routes", "find UI components")
- The feature automatically considers keywords, file paths, types, recency, and import relationships
- Ticket-level suggestions include performance metrics showing tokens saved (60-70% reduction)

## Agents Feature

Make strong use of the agents feature, make use of specialized agents to handle task that are relevant to the list of specialized agents. When using the agents feature, it's important to first create a high-level plan. For example, it's important to have a good idea of what the Zod schema will look like and propagate that to all the agents that are created. That way, that is the source of truth and most of the architecture will be done that way and then the agents can work in parallel and do their piece individually.

### Claude Agent Usage Guidelines

You MUST proactively use Claude's built-in agents at appropriate times:

#### After Feature Implementation

- **Always use `staff-engineer-code-reviewer`** after implementing any significant feature or functionality
- This includes: new components, API endpoints, services, database changes, or any substantial code additions
- The code reviewer will analyze implementation quality, suggest improvements, and catch potential issues

#### When Refactoring or Simplifying

- **Use `code-modularization-expert`** when:
  - User asks to refactor code
  - User asks to simplify files or reduce complexity
  - You identify duplicate patterns that could be consolidated
  - Breaking down large files into smaller, more manageable modules
  - Improving code organization and separation of concerns

#### Other Key Agent Usage

- **Use `frontend-shadcn-expert`** when building React UI components or implementing frontend features
- **Use `hono-bun-api-architect`** when creating or modifying API endpoints
- **Use `zod-schema-architect`** when designing data validation schemas
- **Use `tanstack-router-expert`** when implementing routing logic
- **Use `vercel-ai-sdk-expert`** when implementing AI features
- **Use `promptliano-service-architect`** when creating new Promptliano services
- **Use `promptliano-mcp-tool-creator`** when creating new MCP tools
- **Use `simple-git-integration-expert`** when implementing Git-related features
- **Use `markdown-docs-writer`** when creating documentation
- \*\*Use `sqlite-json-migration-expert` when doing SQLite JSON schema migrations.

### Example Workflow

```
1. User requests: "Add a new user profile feature"
2. You implement: schemas, storage, services, API routes, UI components
3. Automatically use: staff-engineer-code-reviewer to review the implementation
4. If reviewer suggests modularization: use code-modularization-expert
5. Result: High-quality, well-reviewed, modular code
```

### Important Notes

- Don't wait for user to ask for code review - do it proactively
- Use multiple agents concurrently when appropriate for maximum efficiency
- Each agent should receive clear context about what was implemented/changed

## Validation Requirements for UI Navigation and Search Parameters

All UI navigation state (tabs, subtabs, views, filters) is persisted in URL search parameters and validated using Zod schemas. When adding any new UI navigation elements, you MUST update the corresponding validation schemas.

### Key Principle

Any value that appears in the URL search params must have a corresponding Zod schema validation. This includes:

- Main navigation tabs
- Sub-navigation tabs within views
- Filter states
- View modes
- Selected item IDs
- Any other UI state persisted in the URL

### Common Validation Files

- `packages/client/src/lib/search-schemas.ts` - Contains all route search parameter schemas
- `packages/schemas/` - Contains domain-specific schemas for forms and data

### Required Updates When Adding New UI Navigation

1. **Update the enum schema** for the navigation type in `search-schemas.ts`
2. **Add the new value to the enum** with a `.catch()` default
3. **Update the parent search schema** if adding a new navigation category
4. **Update any switch statements** or conditional rendering that handle the navigation
5. **Export types** if needed for TypeScript support
6. **Update navigation components** to handle the new value

### Examples

#### Adding a new subtab to an existing view

```typescript
// In search-schemas.ts
export const claudeCodeViewSchema = z
  .enum(['agents', 'commands', 'sessions', 'chats', 'settings'])
  .catch('agents')
  .optional()
```

#### Adding a new main tab with subtabs

```typescript
// Define the new subtab schema
export const analyticsViewSchema = z.enum(['overview', 'usage', 'performance']).catch('overview').optional()

// Add to the main search schema
export const projectsSearchSchema = tabSearchSchema.merge(projectIdSearchSchema).extend({
  activeView: projectViewSchema,
  gitView: gitViewSchema,
  ticketView: ticketViewSchema,
  assetView: assetViewSchema,
  claudeCodeView: claudeCodeViewSchema,
  analyticsView: analyticsViewSchema // Add here
  // ... other fields
})
```

### Common Issues and Solutions

- **Tab click redirects to wrong view** → Missing enum value in schema
- **Navigation state not persisting** → Schema not added to parent search schema
- **Form validation errors** → Check optional field handling (use `.optional()` and `.catch()`)
- **TypeScript errors** → Update exported types to match schema changes
- **Default tab not working** → Ensure `.catch('default-value')` is set correctly

### Testing Checklist

- [ ] Direct URL navigation works with new tab value
- [ ] Tab click updates URL correctly
- [ ] Refresh maintains selected tab
- [ ] Invalid URL values fall back to default
- [ ] TypeScript compilation passes

## Coding Principles

- Write code that is self explanatory where comments are rarely needed.
- Follow instructions exactly as written. Everything must be very concise but still make sense.
- Optimize code to use the least amount of tokens possible with great readability.
- Remove verbose comments, keep comments short and simple, optimize for token efficiency.
- write modular, functional code. Make sure code is unit testable. Make sure functions are pure and deterministic.
- Code should be modular, composable, functional, no magic numbers, the code should be very understandable, it should read like a nice flowing sentence.
- never use dynamic imports unless you have to

Implement These Practices:

- Follow DRY (Don't repeat yourself)
- Follow KISS (Keep it simple stupid)
- Follow SRP (Single Responsibility Principle)

## Testing

### Running Tests

The project has comprehensive test coverage across multiple packages. Use these commands to run tests:

```bash
# Run all tests across all packages
bun run test:all

# Run tests for individual packages
bun run test:shared      # Shared utilities (133 tests ✅)
bun run test:schemas     # Zod schemas (93 tests, 11 failing ❌)
bun run test:services    # Services layer (multiple failing ❌)
bun run test:storage     # Storage layer (multiple failing ❌)
bun run test:api-client  # API client (multiple failing ❌)
bun run test:config      # Configuration (5 tests ✅)
bun run test:server      # Server (no tests yet ⚠️)
```

### Current Test Status

- **Passing**: `shared` (133), `config` (5)
- **Failing**: `schemas` (11), `services`, `storage`, `api-client`
- **No tests**: `server`

See `TEST_AND_TYPE_REPORT.md` for detailed failure information.

## Type Checking

### Running Type Checks

All packages have TypeScript type checking configured. Use these commands:

```bash
# Run type checks for all packages
bun run typecheck

# Run type checks for individual packages
bun run typecheck:server
bun run typecheck:shared
bun run typecheck:schemas
bun run typecheck:services
bun run typecheck:storage
bun run typecheck:api-client
bun run typecheck:config
bun run typecheck:client
bun run typecheck:website
```

### Type Safety Requirements

- All packages must pass type checking before merging
- Use `tsc --noEmit` to check types without building
- Fix type errors immediately - don't use `@ts-ignore` unless absolutely necessary

## Validation

### Comprehensive Validation

Use the validation scripts for CI/CD and pre-commit checks:

```bash
# Run complete validation (tests + type checks + formatting)
bun run validate

# Run quick validation (type checks + tests only)
bun run validate:quick
```

The `validate` script runs:

1. Type checking for all packages
2. All unit tests
3. Format checking with Prettier

### CI/CD Integration

The `scripts/validate-all.ts` script provides detailed output and exit codes suitable for CI/CD pipelines. It runs validations sequentially and provides a summary report.

## Available Scripts

use bun to run all npm scripts in package.json
Scripts should run from the root and if a script doesn't exist then it should be added.

### Development Scripts

```bash
"dev": "bun run scripts/start-dev.ts"                    # Start full dev environment
"dev:client": "bun run scripts/start-client-dev.ts"      # Start client dev only
"dev:server": "bun run scripts/start-server-dev.ts"      # Start server dev only
"dev:website": "bun run scripts/start-website-dev.ts"    # Start website dev
"stop": "bun run scripts/stop.ts"                        # Stop all dev processes
```

### Build Scripts

```bash
"build-binaries": "bun run scripts/build-binaries.ts"
"build:website": "cd packages/website && bun run build"
"tauri:build": "bun run build-binaries && cd packages/client && bun run tauri:build"
"tauri:build:with-sidecar": "bun run build-binaries && bun run prepare-tauri-sidecars && cd packages/client && bun run tauri:build"
```

### Test Scripts

```bash
"test:all": "bun run test:server && bun run test:shared && bun run test:schemas && bun run test:services && bun run test:storage && bun run test:api-client && bun run test:config"
"test:shared": "cd packages/shared && bun run test"
"test:schemas": "cd packages/schemas && bun run test"
"test:services": "cd packages/services && bun run test"
"test:storage": "cd packages/storage && bun run test"
"test:api-client": "cd packages/api-client && bun run test"
"test:config": "cd packages/config && bun run test"
"test:server": "cd packages/server && bun run test"
```

### Type Check Scripts

```bash
"typecheck": "bun run typecheck:server && bun run typecheck:shared && bun run typecheck:schemas && bun run typecheck:services && bun run typecheck:storage && bun run typecheck:api-client && bun run typecheck:config && bun run typecheck:client && bun run typecheck:website"
"typecheck:server": "cd packages/server && bun run typecheck"
"typecheck:shared": "cd packages/shared && bun run typecheck"
"typecheck:schemas": "cd packages/schemas && bun run typecheck"
"typecheck:services": "cd packages/services && bun run typecheck"
"typecheck:storage": "cd packages/storage && bun run typecheck"
"typecheck:api-client": "cd packages/api-client && bun run typecheck"
"typecheck:config": "cd packages/config && bun run typecheck"
"typecheck:client": "cd packages/client && tsc --noEmit"
"typecheck:website": "cd packages/website && bun run typecheck"
```

### Validation Scripts

```bash
"validate": "bun run scripts/validate-all.ts"           # Full validation
"validate:quick": "bun run typecheck && bun run test:all" # Quick validation
```

### Other Scripts

```bash
"format": "prettier --write ."                           # Format all files
"migrate:sqlite": "bun run scripts/migrate-to-sqlite.ts"
"migrate:sqlite:dry": "bun run scripts/migrate-to-sqlite.ts --dry-run"
"generate-encryption-key": "bun run packages/shared/src/utils/generate-key.ts"
"migrate:encrypt-keys": "bun run packages/storage/src/migrations/encrypt-provider-keys.ts"
"sync-version": "bun run scripts/sync-version.ts"
"update-version": "bun run scripts/update-version.ts"
```
