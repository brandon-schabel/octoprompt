# CLAUDE.md

Operate only through Promptliano MCP. Keep it high level, structured, and token-efficient.

## Golden Path (mandatory)

1. Overview → 2) Plan → 3) Queue → 4) Process → 5) Review → 6) Complete

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
