# CLAUDE.md

## Use Promptliano MCP Extenensively

Do ALL planning, code & searching, through Promptliano MCP. With Promptliano you can create tickets, tasks, and queues. When you are planning tickets and tasks, with the task you can assign suggested files, suggested prompts, suggested agents to use, and the more detailed you are with the tickets and tasks, the better. For example, when creating a task and it needs to make a change in a file somewhere, try to be specific of where to make the change, what to look for, and things like that.

## Workflow

## Golden Path (mandatory)

1. Overview → 2) Plan → 3) Queue → 4) Process → 5) Review → 6) Complete

So whenever you are given a new feature or bug, you'll use the promptliano overview MCP to gain a "bird eye view" of the project. If you are creating the tickets and tasks yourself, then follow this.

- Overview tool
- Use search tools like semantic search and AI search to search files
- Create tickets and tasks with detailed information on how to implement said thing, make sure when creating tasks to always include suggested prompts, files, and agents. These are absolutely crucial to providing better task context. The task should also include a code review that the code is syntactically correct and bug/error free and it should also include unit tests if they are relevant.
- Once the tickets and tasks are created assign them to a queue (preferably one that is empty) if there are no empty queues create a new context relevant queue
- Once the tickets and tasks are in the Queue plan on how you will approach each of the tickets and tasks, make sure that the task ordering make sense, the tickets and tasks have the right details, etc.
- When starting a ticket/task see if there is a recommended agent to load, if there is load that first.Start completing each ticket and tasks one by one, making sure to first load in the correct context, like the suggested files, suggested prompts, and agent.
- When you are done with a ticket it must be marked as complete and verify it gets removed from the Queue this is important

## Available Agents

| Agent                                 | Model  | When to Use                                                      |
| ------------------------------------- | ------ | ---------------------------------------------------------------- |
| **promptliano-planning-architect**    | opus   | Planning tickets/tasks with file suggestions, agent assignments  |
| **staff-engineer-code-reviewer**      | opus   | MANDATORY after implementations for quality review               |
| **promptliano-ui-architect**            | opus   | React UI with shadcn/ui, Tanstack Query/Table                    |
| **promptliano-ui-architect**            | opus   | Building with @promptliano/ui components                         |
| **vercel-ai-sdk-expert**              | opus   | AI features: streaming chat, tool calling, structured generation |
| **code-simplifier-auditor**           | opus   | Find duplication, complexity, inconsistencies                    |
| **code-modularization-expert**        | opus   | Refactor large files into modules                                |
| **github-actions-workflow-architect** | opus   | CI/CD pipelines, GitHub Actions workflows                        |
| **markdown-docs-writer**              | opus   | README, API docs, contribution guides                            |
| **hono-bun-api-architect**            | sonnet | Hono API endpoints with Zod validation                           |
| **typescript-type-safety-auditor**    | sonnet | Remove 'any' types, ensure type safety                           |
| **promptliano-sqlite-expert**      | sonnet | Migrate JSON blobs to relational tables                          |
| **tanstack-router-expert**            | sonnet | TanStack Router implementation, type-safe routes                 |
| **promptliano-service-architect**     | sonnet | Service patterns, database communication                         |
| **zod-schema-architect**              | sonnet | Design Zod schemas as single source of truth                     |
| **promptliano-mcp-tool-creator**      | sonnet | Create/extend MCP tools in Promptliano                           |
| **simple-git-integration-expert**     | sonnet | Git operations, simple-git integration                           |

### Agent Usage Patterns

- **Proactive usage**: Use `staff-engineer-code-reviewer` automatically after writing code
- **Concurrent agents**: Launch multiple agents in parallel for efficiency
- **Agent chaining**: reviewer → simplifier → modularization for refactoring
- **Package-specific**: Use relevant agents based on the package you're working in

### 1) Overview (start here, every session)

```
mcp__promptliano__project_manager(
  action: "overview",
  projectId: 1754713756748
)
```

Gives project context, selected files, tickets, queues, and pending work.

#### Next actions after overview

- If queues have pending items: process next task

```
mcp__promptliano__queue_processor(
  action: "get_next_task",
  data: { queueId: <queue_id>, agentId: "<agent_id>" }
)
```

- If open tickets but no queues: create and enqueue

```
mcp__promptliano__queue_manager(
  action: "create_queue",
  projectId: 1754713756748,
  data: { name: "Work", description: "General work", maxParallelItems: 1 }
)
mcp__promptliano__queue_manager(
  action: "enqueue_ticket",
  projectId: 1754713756748,
  data: { queueId: <queue_id>, ticketId: <ticket_id>, priority: 5 }
)
```

- If no tickets: plan tickets and tasks via architect

```
Task(
  subagent_type: "promptliano-planning-architect",
  description: "Plan feature",
  prompt: "Create tickets and tasks with agents, files, prompts, estimates"
)
```

- If starting work without a queue: enqueue the current ticket before coding

### 2) Plan (tickets + tasks via architect)

```
Task(
  subagent_type: "promptliano-planning-architect",
  description: "Plan feature",
  prompt: "Create tickets/tasks with agents, prompts, files, estimates"
)
```

Tickets/tasks include suggested files, prompts, and agent assignments.

### 3) Queue (structure all work)

```
mcp__promptliano__queue_manager(
  action: "create_queue",
  projectId: 1754713756748,
  data: { name: "Feature Dev", description: "Feature work", maxParallelItems: 1 }
)

mcp__promptliano__queue_manager(
  action: "enqueue_ticket",
  projectId: 1754713756748,
  data: { queueId: 123, ticketId: 456, priority: 5 }
)
```

### 4) Process (pull → load context → implement)

```
// get next task
mcp__promptliano__queue_processor(
  action: "get_next_task",
  data: { queueId: 123, agentId: "my-agent" }
)

// suggested files (fast/balanced/thorough)
mcp__promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 456,
  data: { strategy: "balanced", maxResults: 10 }
)

// read/update files via MCP
mcp__promptliano__project_manager(action: "get_file_content", projectId: 1754713756748, data: { path: "..." })
mcp__promptliano__project_manager(action: "update_file_content", projectId: 1754713756748, data: { path: "...", content: "..." })
```

Processing loop: load agent → load task prompts → load suggested files → implement → tests → review → complete.

### 5) Review (always)

```
Task(
  subagent_type: "staff-engineer-code-reviewer",
  description: "Review implementation",
  prompt: "Review for quality, security, performance"
)
```

Add additional targeted reviews as needed (API, frontend, types).

### 6) Complete (sync status + queues)

```
mcp__promptliano__queue_processor(
  action: "complete_task",
  data: { itemId: 789, completionNotes: "Done" }
)
```

Completing tasks updates ticket/task state and queue stats.

## File Suggestions (token-efficient)

- fast: no AI, instant
- balanced: filter + AI (default)
- thorough: maximum AI

```
// project-level exploration
mcp__promptliano__project_manager(
  action: "suggest_files",
  projectId: 1754713756748,
  data: { prompt: "auth", limit: 10 }
)
```

Always prefer suggestions before manual searching.

## Essential Tools (minimal reference)

- project_manager: overview, suggest_files, get_file_content, update_file_content
- ticket_manager: create, list, suggest_tasks, suggest_files, auto_generate_tasks
- task_manager: create, list, update, suggest_files, batch_create
- queue_manager: create_queue, enqueue_ticket, enqueue_item, get_stats, list_queues
- queue_processor: get_next_task, update_status, complete_task, fail_task, check_queue_status
- prompt_manager: create, list_by_project, suggest_prompts
- agent_manager: list, suggest_agents, get

## Rules (non-negotiable)

- Always start with Overview, then follow the Golden Path.
- Use planning architect for all planning.
- Enforce queues for all implementation work.
- Use MCP file ops for reading/writing; avoid manual edits first.
- Run specialized review agents before completion.

## Tips

- Load context in order: agent → prompts → files.
- Keep changes small, testable, and validated in-loop.
- Monitor queues: `queue_manager(get_stats)`; retry or release stuck items.
- Save key patterns as prompts via `prompt_manager`.

## Package Reference

| Package                          | Purpose                             | Relevant Agents                                              |
| -------------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| **@promptliano/schemas**         | Zod schemas, single source of truth | zod-schema-architect, typescript-type-safety-auditor         |
| **@promptliano/storage**         | SQLite persistence, migrations      | promptliano-sqlite-expert, promptliano-service-architect  |
| **@promptliano/services**        | Business logic, orchestration       | promptliano-service-architect, simple-git-integration-expert |
| **@promptliano/server**          | Hono API, MCP tools                 | hono-bun-api-architect, promptliano-mcp-tool-creator         |
| **@promptliano/api-client**      | Type-safe API client                | typescript-type-safety-auditor                               |
| **@promptliano/client**          | React app, main UI                  | promptliano-ui-architect, tanstack-router-expert               |
| **@promptliano/ui**              | Component library, shadcn/ui        | promptliano-ui-architect, promptliano-ui-architect               |
| **@promptliano/website**         | Marketing site                      | markdown-docs-writer, promptliano-ui-architect                 |
| **@promptliano/config**          | Shared configuration                | zod-schema-architect                                         |
| **@promptliano/shared**          | Utilities, helpers                  | code-simplifier-auditor                                      |
| **@promptliano/mcp-client**      | MCP protocol client                 | promptliano-mcp-tool-creator                                 |
| **@promptliano/brand-kit**       | Design system, colors               | promptliano-ui-architect                                       |
| **@promptliano/promptliano**     | CLI package                         | github-actions-workflow-architect                            |
| **@promptliano/prompt-engineer** | Prompt optimization                 | vercel-ai-sdk-expert                                         |

## Promptliano Feature Development (12 steps)

Source: `.claude/agents/promptliano-planning-architect.md`. Use `promptliano-planning-architect` to plan tickets/tasks along this flow.

1. Design Zod Schemas — Create data models as the single source of truth
2. Create Storage Layer — Implement SQLite storage with column-based design
3. Create Database Migration — Design tables with proper indexes
4. Implement Service Layer — Build business logic with error handling
5. Create API Routes — Implement Hono endpoints with OpenAPI
6. Create MCP Tool — Make feature accessible to AI agents
7. Update API Client — Add type-safe client methods
8. Create React Hooks — Implement Tanstack Query hooks with invalidations
9. Build UI Components — Create reusable ShadCN components
10. Integrate into Pages — Wire up the feature in the UI
11. Comprehensive Code Review (MANDATORY) — Use staff-engineer-code-reviewer
12. Address Review Feedback — Fix all issues before completion

## Testing & Type Safety (ALWAYS USE BUN)

All test, build, validation, and typecheck commands MUST be executed with Bun. Do not use npm, yarn, or pnpm inside this repository. When generating commands, prefer the existing package scripts (bun run <script>) before inventing new ad‑hoc commands.

### Core Scripts (root package.json)

Fast loop:

- Quick validate (type + tests subset):
  bun run validate:quick

Full loop:

- Full typecheck (all workspaces):
  bun run typecheck
- Full test suite (all packages):
  bun run test:all
- Full validation (custom script aggregation):
  bun run validate

Targeted package test scripts:

- Storage: bun run test:storage
- Services: bun run test:services
- Schemas: bun run test:schemas
- Shared: bun run test:shared
- Server: bun run test:server
- API Client: bun run test:api-client
- Config: bun run test:config

Specialized tests:

- Queue core tests: bun run test:queue
- Queue e2e system: bun run test:queue:e2e
- Summarization file tests: bun run test:summarization
- Local model tests (requires LM Studio endpoint):
  LMSTUDIO_BASE_URL=http://<host>:1234 bun run test:local-models
- AI summarization e2e (long-running):
  bun run test:ai-e2e

Direct Bun test targeting (bypass scripts only when necessary):
bun test packages/services/src/tests/file-summarization.test.ts

### Type Checking

Per-package typecheck scripts (invoked by root typecheck):

- bun run typecheck:server / :shared / :schemas / :services / :storage / :api-client / :config / :client / :website

If iterating in a single package, prefer running only its script to reduce feedback time. Always finish with bun run typecheck before committing large changes.

### Recommended AI Agent Workflow for Code Changes

1. Run bun run typecheck:storage (or relevant package) after modifying storage or schema code.
2. Run bun run test:<package> for the nearest scope.
3. If adding new cross-package types, run bun run typecheck for full workspace.
4. Before marking a ticket complete, run:
   bun run validate:quick
   bun run validate (if substantial backend or schema changes)

### Writing / Updating Tests

- Use Bun’s built-in test runner (no Jest config required).
- Prefer colocated \*.test.ts files already present (see packages/\*\*/src/tests or root package test patterns).
- Keep tests deterministic; avoid real network unless explicitly required. For provider/model integration tests, gate behind env vars (e.g., LMSTUDIO_BASE_URL) that default to skipping if unset.

### Performance & Long-Running Tests

- Summarization and AI e2e tests have higher timeouts; only run them when touching summarization logic:
  bun run test:ai-e2e
- For quick feedback, exclude them by using narrower scripts first.

### Debugging a Single Failing Test

bun test path/to/file.test.ts --timeout 20000 --filter "Partial name"

### Environment Variables Common in Tests

- LMSTUDIO_BASE_URL: Points to local model server for AI-related integration tests.
- PROMPTLIANO_ENCRYPTION_KEY: Can be set to avoid key generation prompts during encryption-dependent tests.

### Linting / Formatting

- Formatting handled via Prettier: bun run format
- No separate lint script presently; rely on typechecker + tests.

### Adding New Scripts

When adding new test or typecheck scripts, ensure they follow the pattern:
"test:foo": "cd packages/foo && bun run test"
so root orchestrators can chain them. Update this CLAUDE.md if a new critical script is introduced.

### Absolute Rules for AI Agents

1. Always choose Bun commands.
2. Prefer existing scripts; only fall back to raw bun test if granular targeting is required.
3. After edits to storage, schemas, or services: run at least package-level test + typecheck.
4. Before queueing Review: run bun run validate:quick (minimum standard).
5. Never introduce npm install steps; dependencies are managed via workspaces and Bun.

### Example Minimal CI-Like Local Gate

bun run typecheck && bun run test:all

If either fails, do not proceed to queue completion.

### Troubleshooting

- Out-of-date generated types? Re-run any generation scripts (check scripts/ directory) then bun run typecheck.
- SQLite test DB issues? Remove temporary _.db files in data/ or packages/_ and re-run tests.
- Flaky long AI tests: re-run only the failing spec with bun test <file> before broader retries.

Maintaining these practices ensures consistent, type-safe evolution of the codebase and predictable agent automation.
