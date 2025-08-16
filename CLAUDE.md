# CLAUDE.md

# ⚠️ STOP - AGENT CHECKPOINT ⚠️

Before ANY code changes:
1. ✅ Did you load the specialized agent? (NO EXCEPTIONS)
2. ✅ Did you check the agent matrix for the right specialist?
3. ✅ Are you using promptliano-planning-architect for planning?

If ANY answer is NO → STOP and load the correct agent first.

**HOW TO LOAD AN AGENT:**
```python
Task(
  subagent_type: "<agent-name-from-matrix>",
  description: "What you're doing",
  prompt: "Implementation details"
)
```
Then continue ONLY after agent is loaded.

## 🎯 AGENT QUICK REFERENCE (USE THIS FIRST)

| If you're working on... | USE THIS AGENT (MANDATORY) |
|-------------------------|----------------------------|
| Planning any feature/bug | `promptliano-planning-architect` |
| Database/SQLite | `promptliano-sqlite-expert` |
| API endpoints | `hono-bun-api-architect` |
| API testing | `api-test-automation-expert` |
| UI/React components | `promptliano-ui-architect` |
| Forms | `promptliano-forms-architect` |
| Zod schemas | `zod-schema-architect` |
| Service logic | `promptliano-service-architect` |
| Code review (ALWAYS after) | `staff-engineer-code-reviewer` |

**EVERY TASK = AGENT FIRST, CODE SECOND**

## ❌ CIRCUIT BREAKERS - These trigger IMMEDIATE STOP

If you catch yourself doing ANY of these, STOP:
- Writing code without `Task(subagent_type: ...)` already executed
- Implementing directly after reading a file
- Skipping planning for "simple" changes
- Marking tasks complete without review agent

**RECOVERY:** Stop → Load correct agent → Start over WITH agent

## 🚦 DEVELOPMENT GATES (MUST PASS IN ORDER)

### GATE 1: Planning (CANNOT PROCEED WITHOUT)
```
✓ promptliano-planning-architect loaded
✓ Tickets created with agent assignments
✓ Each task specifies its specialist
```

### GATE 2: Implementation (CANNOT START WITHOUT)
```
✓ Specialized agent loaded for THIS task
✓ Agent matches the task domain
✓ Context loaded AFTER agent
```

### GATE 3: Review (CANNOT COMPLETE WITHOUT)
```
✓ staff-engineer-code-reviewer loaded
✓ Review completed
✓ Feedback addressed
```

## 🚫 THESE PATTERNS WILL BE REJECTED

```typescript
// ❌ WRONG - Direct implementation
const newFeature = () => { ... }

// ✅ CORRECT - Agent first
Task(subagent_type: "promptliano-ui-architect", ...)
// THEN implement within agent context
```

```typescript
// ❌ WRONG - Reading then coding
mcp__promptliano__project_manager(get_file_content...)
// Then writing code directly

// ✅ CORRECT - Agent, then read, then code
Task(subagent_type: "appropriate-agent", ...)
// THEN read files
// THEN implement
```

## 📋 COPY-PASTE AGENT TEMPLATE

For EVERY task, start with:

```python
# 1. ALWAYS START HERE
Task(
  subagent_type: "[CHECK MATRIX FOR RIGHT AGENT]",
  description: "[What you're implementing]",
  prompt: """
    Context: [Why this change]
    Requirements: [What needs to be done]
    Files: [Relevant files]
    Patterns: [Follow existing patterns in...]
    Testing: [How to validate]
  """
)

# 2. ONLY AFTER AGENT IS LOADED, proceed with:
# - Reading files
# - Writing code
# - Running tests
```

## 📌 AGENT SYSTEM STATUS
**Version:** 2.0 (Mandatory Enforcement)
**Updated:** 2025-08-15
**Compliance:** REQUIRED - Non-negotiable

⚠️ **BREAKING CHANGE:** Direct implementation is now FORBIDDEN.
All code must go through specialized agents or it will be rejected.

# 🔴 ONE RULE: NO CODE WITHOUT AGENTS 🔴

**EVERY** line of code you write MUST be written through a specialized agent.

**How:** 
1. Find the right agent in the matrix
2. Load it with `Task(subagent_type: "agent-name", ...)`
3. ONLY THEN write code

**No exceptions. No shortcuts. No "just this once".**

If you're not sure which agent → use `promptliano-planning-architect`

## ✅ BEFORE EVERY COMMIT - THE RITUAL

Say out loud (or type):
1. "I loaded the specialized agent for this task"
2. "The agent I used was: [name]"
3. "I ran the code reviewer agent"

If you can't answer all three → YOU MUST START OVER

## MANDATORY: Always Use Specialized Agents

**CRITICAL RULE**: You MUST use the specialized agent system for ALL work. NO direct implementation without proper agent assignment.

### Agent-First Development Philosophy

1. **Every task REQUIRES an agent assignment** - No exceptions
2. **Always plan first** - Use `promptliano-planning-architect` for ALL feature/bug work
3. **Every plan MUST specify agents** - Each task must have a recommended agent
4. **Agent specialization is mandatory** - Use the right agent for each domain

## Use Promptliano MCP Extensively

Do ALL planning, code & searching, through Promptliano MCP. With Promptliano you can create tickets, tasks, and queues. When you are planning tickets and tasks, with the task you can assign suggested files, suggested prompts, suggested agents to use, and the more detailed you are with the tickets and tasks, the better. For example, when creating a task and it needs to make a change in a file somewhere, try to be specific of where to make the change, what to look for, and things like that.

## Workflow

## Golden Path (MANDATORY - NO SHORTCUTS)

1. Overview → 2) **Plan with Agents** → 3) Queue → 4) **Process with Agents** → 5) **Review with Agents** → 6) Complete

### Enforcement Rules:
- **NEVER skip planning step** - Even for "simple" tasks
- **EVERY task needs an agent** - No direct implementation allowed
- **Agent assignments are non-negotiable** - Follow the specialization matrix
- **Planning architect is mandatory** - Use for all feature/bug planning

So whenever you are given a new feature or bug, you'll use the promptliano overview MCP to gain a "bird eye view" of the project. If you are creating the tickets and tasks yourself, then follow this.

### Detailed Workflow Steps:

1. **Overview Tool** - Always start here to understand project context
2. **Use search tools** - Semantic search and AI search to find relevant files
3. **MANDATORY Agent Planning** - Create tickets/tasks with REQUIRED agent assignments:
   - **Every task MUST specify a recommended agent** 
   - **Agent assignment is NOT optional** - Choose from the specialized agent matrix
   - **Include detailed context**: suggested prompts, files, and agent rationale
   - **Mandatory code review task**: Use `staff-engineer-code-reviewer` for all implementations
   - **Include unit tests**: Where relevant, specify test requirements
4. **Queue Assignment** - Assign tickets/tasks to appropriate queues
5. **Queue Planning** - Verify task ordering and agent assignments make sense
6. **Agent-Based Execution** - **ALWAYS load recommended agent FIRST**:
   - Load agent → Load suggested prompts → Load suggested files → Implement
   - **NO direct implementation without agent** - This is strictly forbidden
7. **Completion Verification** - Mark tasks complete and verify queue removal

### Agent Assignment Rules (NON-NEGOTIABLE):

- **Planning work** → `promptliano-planning-architect` (ALWAYS)
- **Schema design** → `zod-schema-architect` (ALWAYS)
- **Database work** → `promptliano-sqlite-expert` (ALWAYS)
- **Service layer** → `promptliano-service-architect` (ALWAYS)
- **API endpoints** → `hono-bun-api-architect` (ALWAYS)
- **UI components** → `promptliano-ui-architect` (ALWAYS)
- **Forms** → `promptliano-forms-architect` (ALWAYS)
- **Routing** → `tanstack-router-expert` (ALWAYS)
- **Type safety** → `typescript-type-safety-auditor` (ALWAYS)
- **Code review** → `staff-engineer-code-reviewer` (MANDATORY after ALL work)
- **AI features** → `vercel-ai-sdk-expert` (ALWAYS)
- **Git operations** → `simple-git-integration-expert` (ALWAYS)
- **MCP tools** → `promptliano-mcp-tool-creator` (ALWAYS)
- **API testing** → `api-test-automation-expert` (ALWAYS)
- **Documentation** → `markdown-docs-writer` (ALWAYS)
- **CI/CD** → `github-actions-workflow-architect` (ALWAYS)

## Complete Agent Specialization Matrix

### TIER 1: Planning & Review (MANDATORY FOR ALL WORK)

| Agent                               | Model | Usage | Domain |
| ----------------------------------- | ----- | ----- | ------ |
| **promptliano-planning-architect**  | opus  | 🔥 REQUIRED for ALL planning | Break down features into agent-assigned tasks |
| **staff-engineer-code-reviewer**    | opus  | 🔥 MANDATORY after ALL implementations | Code quality, security, performance review |

### TIER 2: Core Development (PRIMARY IMPLEMENTATION)

| Agent                               | Model | Usage | Domain |
| ----------------------------------- | ----- | ----- | ------ |
| **zod-schema-architect**            | sonnet | ALWAYS for schemas | Zod schemas as single source of truth |
| **promptliano-sqlite-expert**       | sonnet | ALWAYS for database | SQLite storage, migrations, queries |
| **promptliano-service-architect**   | sonnet | ALWAYS for services | Business logic, service patterns |
| **hono-bun-api-architect**          | sonnet | ALWAYS for APIs | Hono endpoints with OpenAPI/Zod |
| **promptliano-ui-architect**        | opus  | ALWAYS for UI | @promptliano/ui components, forms, tables |
| **promptliano-forms-architect**     | opus  | ALWAYS for forms | Form systems, validation, UX |
| **tanstack-router-expert**          | sonnet | ALWAYS for routing | Type-safe routes, navigation |

### TIER 3: Specialized Features

| Agent                               | Model | Usage | Domain |
| ----------------------------------- | ----- | ----- | ------ |
| **vercel-ai-sdk-expert**           | opus  | ALWAYS for AI | Streaming chat, tool calling, structured output |
| **promptliano-mcp-tool-creator**   | sonnet | ALWAYS for MCP | Model Context Protocol tools |
| **simple-git-integration-expert**  | sonnet | ALWAYS for Git | Git operations, version control |
| **typescript-type-safety-auditor** | sonnet | ALWAYS for types | Type safety, 'any' removal, validation |
| **api-test-automation-expert**     | opus  | ALWAYS for API tests | Isolated test environments, API integration tests |

### TIER 4: Quality & Optimization

| Agent                               | Model | Usage | Domain |
| ----------------------------------- | ----- | ----- | ------ |
| **code-simplifier-auditor**        | opus  | Pattern opportunities | Find duplication, complexity reduction |
| **code-modularization-expert**     | opus  | Large file splitting | Refactor monoliths into modules |
| **code-patterns-implementer**      | opus  | Pattern migration | Implement established utility patterns |

### TIER 5: DevOps & Documentation

| Agent                               | Model | Usage | Domain |
| ----------------------------------- | ----- | ----- | ------ |
| **github-actions-workflow-architect** | opus | ALWAYS for CI/CD | GitHub Actions, workflows, deployment |
| **markdown-docs-writer**           | opus  | ALWAYS for docs | README, API docs, guides |

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

### 2) Plan ⚠️ REMINDER: AGENT REQUIRED HERE (MANDATORY Agent Assignment via Planning Architect)

```
Task(
  subagent_type: "promptliano-planning-architect",
  description: "Plan feature with agent assignments",
  prompt: "Create comprehensive tickets/tasks with MANDATORY agent assignments. EVERY task must specify:
  - Recommended agent from the specialization matrix
  - Rationale for agent choice
  - Suggested files for context
  - Suggested prompts for implementation
  - Time estimates and dependencies
  - Testing requirements
  CRITICAL: No task should be created without a specific agent assignment."
)
```

**Planning Requirements:**
- **EVERY ticket/task MUST have a specific agent assigned**
- **Agent choice MUST follow the specialization matrix**
- **Rationale MUST be provided** for agent selection
- **Context MUST be comprehensive** (files, prompts, approach)
- **Mandatory review task** with `staff-engineer-code-reviewer`

**Example Task with Agent Assignment:**
```
Task: "Implement user authentication API endpoint"
Agent: hono-bun-api-architect
Rationale: API endpoint with Zod validation requires Hono expertise
Files: packages/server/src/routes/, packages/schemas/src/auth.schemas.ts
Prompts: "API endpoint patterns", "Zod validation setup"
Estimated: 2 hours
Testing: Integration tests for auth flow (use api-test-automation-expert)
Review: staff-engineer-code-reviewer for security validation
```

**Additional Task for New Services:**
```
Task: "Create API tests for authentication service"
Agent: api-test-automation-expert
Rationale: New service requires isolated integration tests
Files: packages/api-client/src/tests/, packages/server/src/routes/
Prompts: "API test patterns", "isolated test environments"
Estimated: 1 hour
Testing: Comprehensive endpoint coverage with isolated test server
Review: staff-engineer-code-reviewer for test quality validation
```

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

### 4) Process ⚠️ REMINDER: SPECIALIZED AGENT REQUIRED (MANDATORY: Agent → Context → Implement)

**CRITICAL RULE: NEVER implement directly. ALWAYS load the assigned agent first.**

```
// 1. Get next task with agent assignment
mcp__promptliano__queue_processor(
  action: "get_next_task",
  data: { queueId: 123, agentId: "my-agent" }
)

// 2. MANDATORY: Load the assigned agent FIRST
Task(
  subagent_type: "<AGENT_FROM_TASK_ASSIGNMENT>",
  description: "<Task description>",
  prompt: "<Implementation details with context>"
)

// 3. Load suggested files (after agent is loaded)
mcp__promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 456,
  data: { strategy: "balanced", maxResults: 10 }
)

// 4. Read/update files via MCP (within agent context)
mcp__promptliano__project_manager(action: "get_file_content", projectId: 1754713756748, data: { path: "..." })
mcp__promptliano__project_manager(action: "update_file_content", projectId: 1754713756748, data: { path: "...", content: "..." })
```

**Mandatory Processing Order:**
1. **Pull task** → Extract assigned agent
2. **Load specialized agent** → REQUIRED, never skip
3. **Load task prompts** → Implementation guidance
4. **Load suggested files** → Context and examples
5. **Implement with agent** → Let specialist handle the work
6. **Run tests** → Validate implementation
7. **Load review agent** → `staff-engineer-code-reviewer`
8. **Complete task** → Mark as done and update queue

**FORBIDDEN PATTERNS:**
- ❌ Direct implementation without agent
- ❌ Skipping the assigned agent
- ❌ Generic implementation without specialization
- ❌ Completing work without review agent

### 5) Review ⚠️ REMINDER: MANDATORY REVIEWER AGENT (always)

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

## Rules (STRICTLY ENFORCED - NO EXCEPTIONS)

### CRITICAL ENFORCEMENT RULES:

1. **AGENT-FIRST MANDATE**: 
   - 🚫 **FORBIDDEN**: Direct implementation without specialized agent
   - ✅ **REQUIRED**: Load appropriate agent for every single task
   - ⚠️ **VIOLATION**: Any code written without agent assignment is INVALID

2. **PLANNING MANDATE**:
   - 🚫 **FORBIDDEN**: Starting work without planning step
   - ✅ **REQUIRED**: Use `promptliano-planning-architect` for ALL features/bugs
   - ⚠️ **VIOLATION**: Any work without formal plan is INVALID

3. **AGENT ASSIGNMENT MANDATE**:
   - 🚫 **FORBIDDEN**: Tasks without specific agent assignments
   - ✅ **REQUIRED**: Every task must specify exact agent from matrix
   - ⚠️ **VIOLATION**: Generic tasks without agent specialization are INVALID

4. **REVIEW MANDATE**:
   - 🚫 **FORBIDDEN**: Completing work without `staff-engineer-code-reviewer`
   - ✅ **REQUIRED**: Mandatory review after ALL implementations
   - ⚠️ **VIOLATION**: Unreviewed code is INVALID and must be rejected

5. **QUEUE MANDATE**:
   - 🚫 **FORBIDDEN**: Ad-hoc implementation outside queue system
   - ✅ **REQUIRED**: All work must flow through queue management
   - ⚠️ **VIOLATION**: Direct work bypassing queues is INVALID

### TRADITIONAL RULES (STILL APPLY):

- Always start with Overview, then follow the Golden Path
- Enforce queues for all implementation work
- Use MCP file ops for reading/writing; avoid manual edits first
- Run specialized review agents before completion

### ENFORCEMENT ACTIONS:

If these rules are violated:
1. **STOP immediately** and correct the violation
2. **Restart with proper agent** assignment
3. **Re-plan if necessary** to include agent assignments
4. **Never proceed** with non-compliant work

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

## Promptliano Feature Development (13 steps)

Source: `.claude/agents/promptliano-planning-architect.md`. Use `promptliano-planning-architect` to plan tickets/tasks along this flow.

1. Design Zod Schemas — Create data models as the single source of truth
2. Create Storage Layer — Implement SQLite storage with column-based design
3. Create Database Migration — Design tables with proper indexes
4. Implement Service Layer — Build business logic with error handling
5. Create API Routes — Implement Hono endpoints with OpenAPI
6. Create API Tests — Use api-test-automation-expert for isolated integration tests
7. Create MCP Tool — Make feature accessible to AI agents
8. Update API Client — Add type-safe client methods
9. Create React Hooks — Implement Tanstack Query hooks with invalidations
10. Build UI Components — Create reusable ShadCN components
11. Integrate into Pages — Wire up the feature in the UI
12. Comprehensive Code Review (MANDATORY) — Use staff-engineer-code-reviewer
13. Address Review Feedback — Fix all issues before completion

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

## ✅ VALIDATION RITUAL - Ask Yourself Before Every Implementation

Before writing ANY code, validate:

### Pre-Implementation Checklist:
- [ ] Did I load the specialized agent for this exact task?
- [ ] Is this agent from the approved matrix?
- [ ] Did I check if this needs planning first?
- [ ] Am I following the copy-paste template above?

### During Implementation:
- [ ] Am I working WITHIN the loaded agent context?
- [ ] Am I following patterns the agent suggests?
- [ ] Am I avoiding direct file editing without agent guidance?

### Post-Implementation:
- [ ] Did I run the staff-engineer-code-reviewer?
- [ ] Have I addressed all review feedback?
- [ ] Can I state which specific agent handled this work?

**If ANY checkbox is unchecked → STOP and restart with proper agent**

## FINAL REMINDER: AGENT-FIRST DEVELOPMENT

### The Agent-First Philosophy

Promptliano operates on an **agent-first development model**. This means:

🎯 **Every piece of work requires specialist expertise**
🎯 **No generic development - always use domain experts**  
🎯 **Planning drives agent assignment drives quality**
🎯 **Specialization leads to better first-time results**

### Success Metrics

When following the agent-first approach:

- ✅ **75-90% fewer iterations** - Specialists get it right the first time
- ✅ **90%+ pattern adoption** - Agents enforce established patterns
- ✅ **Consistent quality** - Every domain has expert oversight
- ✅ **Faster development** - No learning curve, immediate expertise
- ✅ **Better architecture** - Domain experts make better decisions

### Common Violations to Avoid

❌ **"This is just a small change"** - Still needs appropriate agent
❌ **"I know how to do this"** - Agent provides pattern enforcement
❌ **"It's faster to do it directly"** - Leads to inconsistency and rework
❌ **"The agent is overkill"** - Specialization is never overkill

### Remember

The specialized agent system exists to ensure that **every piece of code is written by a domain expert** who understands the current patterns, established utilities, and architectural decisions. This leads to:

- Code that follows established patterns immediately
- Implementations that integrate properly with existing systems
- Fewer bugs and security issues
- Better performance and maintainability
- Consistent quality across the entire codebase

**When in doubt: Use an agent. When certain: Still use an agent.**
