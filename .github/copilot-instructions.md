# CLAUDE.md

You are an expert at using the Promptliano MCP, the Promptliano MCP will guide you using a method called the "human in the loop" method. The goal is to use the Promptliano information to guide you on what to do, to gather important context in a token efficient way. The tools are designed to be fast, effective, reliable, and token efficient. The Goal is to rapidly build context and lean on Promptliano to retain context.

You must use the "promptliano-planning-architect" agent to do ALL project planning.

If the user ever mentions, plans, tasks, or tickets, immediately use the promptliano-planning-architect

- Use the Promptliano MCP Overview tool to understand what the user is currently working on, this will give you insights
  into their active project id, selected files, recent tickets. From there using Promptliano for everything form understanding the codebase to ticket and task planning.
- Use the Promptliano prompts feature to save knowledge that is relevant to the project and also retrieve important documentation that the user has saved from the various libraries and tools that they may be using.
- When building new features use Promptliano to understand the architecture of the project. try to follow the patterns that the project is already using.
- Before searching the internet for library docs, check to see if the user already has library docs in their Promptliano prompts library

Generally a fullstack feature consists of the follow

- Zod data schemas
- Data storage and table definitions for SQLite with zod validations
- Services using the zod schemas as the source of truth
- Create MCP tools so AIs can use the new service
- Feature routes with zod + hono openAPI integration
- Add routes to api-client
- Setup data hook using react tanstack query that consume the api-client and add data invalidations where it makes sense
- Explorer if there are current components that meet current uses cases, if not add ShadCN components or compose new components based on the foundations of the primitive componets in the repo
- Integrate components and data hooks into a page to complete the feature

## File Suggestions Feature

The AI file suggestion feature has been optimized to use 60-70% fewer tokens. Three MCP methods are available:

### 1. Project-Level Suggestions (General Discovery)

Use when exploring files based on a text prompt:

```
mcp__Promptliano__project_manager(
  action: "suggest_files",
  projectId: 1754713756748,
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

use bun to run all npm scripts in package.json
Scripts should run from the root and if a script doesn't exist then it should be added.
Below are available scripts and what they do.

```
scripts: {
"dev": "bun run scripts/start-dev.ts",
    "dev:client": "bun run scripts/start-client-dev.ts",
    "dev:server": "bun run scripts/start-server-dev.ts",
    "stop": "bun run scripts/stop.ts",
    "build-binaries": "bun run scripts/build-binaries.ts",
    "prepare-tauri-sidecars": "bun run scripts/prepare-tauri-sidecars.ts",
    "prepare-dev-sidecar": "bun run scripts/prepare-dev-sidecar.ts",
    "tauri:dev": "bun run prepare-dev-sidecar && cd packages/client && bun run tauri:dev",
    "tauri:build": "bun run build-binaries && cd packages/client && bun run tauri:build",
    "tauri:build:with-sidecar": "bun run build-binaries && bun run prepare-tauri-sidecars && cd packages/client && bun run tauri:build",
    "format": "prettier --write .",
    "test:shared": "cd packages/shared && bun run test",
    "test:schemas": "cd packages/schemas && bun run test",
    "test:services": "cd packages/services && bun run test",
    "test:storage": "cd packages/storage && bun run test",
    "test:api-client": "cd packages/api-client && bun run test",
    "test:config": "cd packages/config && bun run test",
    "test:all": "bun run test:server && bun run test:shared && bun run test:schemas && bun run test:services && bun run test:storage && bun run test:api-client && bun run test:config",
    "migrate:sqlite": "bun run scripts/migrate-to-sqlite.ts",
    "migrate:sqlite:dry": "bun run scripts/migrate-to-sqlite.ts --dry-run",
    "generate-encryption-key": "bun run packages/shared/src/utils/generate-key.ts",
    "migrate:encrypt-keys": "bun run packages/storage/src/migrations/encrypt-provider-keys.ts",
    "dev:website": "bun run scripts/start-website-dev.ts",
    "build:website": "cd packages/website && bun run build",
    "preview:website": "cd packages/website && bun run preview"
}
```
