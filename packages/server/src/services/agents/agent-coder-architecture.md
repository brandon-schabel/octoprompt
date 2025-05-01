### Agent-Coder Service — Compact Architecture Summary  
*(TypeScript + Bun runtime, React client, Zod-validated OpenAPI route)*  

---

#### 1. High-Level Purpose  
The **Agent-Coder Service** takes a natural-language instruction plus a set of project files and automatically:

1. **Plans** concrete tasks.  
2. **(Optionally) Creates/updates tests** to reflect the new behaviour.  
3. **Generates a structured code-change plan**.  
4. **Applies the edits** to the source tree with `ts-morph`.  
5. **(Optionally) Runs tests** in a retry loop until they pass.  

It returns the updated files and a task-plan audit trail so the UI can refresh and show exactly what happened.

---

#### 2. End-to-End Data Flow  

| # | Stage | Module/File | Key Types | Notes |
|---|-------|-------------|-----------|-------|
| 1 | **UI gathers context** | `prompt-overview-panel.tsx` | — | User selects files & writes a prompt. |
| 2 | **Mutation hook** | `use-agent-coder-api.ts` | `AgentCoderRunRequest` | Wraps `react-query`; POSTs to backend and shows toasts. |
| 3 | **OpenAPI route** | `agent-coder-routes.ts` | Zod schemas <br>`AgentCoderRunRequest / Response` | - Validates params/body <br>- Loads selected files <br>- Calls `mainOrchestrator` <br>- Maps errors to `ApiError`. |
| 4 | **Orchestrator** | `agent-coder-service.ts` → `mainOrchestrator()` | `TaskPlan`, `CodeModificationPlan` | Drives the multi-agent pipeline (below). Keeps **in-memory state**: `fileState`, `taskPlanState`, `lastTestResults`. |
| 5 | **Agents** | `agent-coder-service.ts` & `agent-tester-plugin.ts` | see right → | • **Planning Agent** → task list <br>• **Test Agent** (opt.) → edits/creates `*.test.ts` <br>• **Code-Change Planning Agent** → fine-grained edit plan <br>• **Implementation Agent** → applies plan with `ts-morph` <br>• **Test Runner / Parser** (opt.) → executes `bun test --reporter=junit`, parses XML, feeds failures back for up to 3 retries |
| 6 | **HTTP response** | route → UI | `AgentCoderRunResponse` | Contains `updatedFiles` and full task plan. |
| 7 | **Client cache refresh** | `useRunAgentCoder` `onSuccess` | — | Invalidates `getApiProjectsByProjectIdFiles` query so file tree reflects new code. |

---

#### 3. Key Integration Points  

| Layer | Details |
|-------|---------|
| **React UI** | *Single button* **Run Agent** triggers the hook. Loading state & toast feedback are handled locally. |
| **Network/Transport** | REST endpoint `POST /api/projects/:projectId/agent-coder` documented via `@hono/zod-openapi`; strict Zod validation prevents malformed calls. |
| **Contracts** | All payloads typed & validated in **shared** package. Same TypeScript types compile on both client and server, eliminating serialization drift. |
| **Error Handling** | Client & server share `ApiError` shape. Route translates domain errors (missing files, orchestrator failure) into 4xx/5xx JSON responses; client hook funnels them through `commonErrorHandler`. |
| **Caching** | Because file mutations are project-scoped, invalidation uses the generated `react-query` key helper, guaranteeing the UI re-fetches only the affected file list. |

---

#### 4. Internal Agent Logic ­(condensed)  

```mermaid
flowchart TD
    UI[[User Prompt<br>& File IDs]]
    UI -->|POST| Route
    Route --> Orchestrator
    subgraph Agent Pipeline
        Orchestrator --> Plan(Planning Agent)
        Plan -->|TaskPlan| (optTests)?? TestGen[Test Agent]
        Plan --> CodePlan(Code-Change Planner)
        CodePlan --> Impl(Code Implementation)
        Impl -->|Updated files| (optRunTests)?? TestExec[Test Runner]
        TestExec --> Parse(Parse JUnit)
        Parse -->|fail? retry : done| Orchestrator
    end
    Orchestrator --> Route
    Route --> UI
```

*Dashed stages appear only when `runTests=true`.*

---

#### 5. Technology Choices Rationale (one-liners)

* **Bun runtime** – unified TS execution, fast test runner, `$` shell helper.  
* **ts-morph (AST)** – structural edits safer than text/diff; preserves formatting.  
* **Vercel AI SDK `generateStructuredData`** – narrows LLM output to Zod schema, removing brittle parsing.  
* **Zod** – single-source schemas power OpenAPI docs, runtime validation, and static types.  
* **react-query** – mutation lifecycle + cache management with minimal code.  

---

#### 6. Extension Hooks

* **Replace in-memory maps** with DB persistence for large projects.  
* **Custom Bun reporter** emitting JSON → richer test feedback without XML parsing.  
* **LLM retry policy**: orchestrator already supports max-attempt loop; plug in more sophisticated heuristics or human-in-the-loop approval.  

---

#### 7. File/Function Quick Map

| Path | Responsibility |
|------|----------------|
| **client/**<br>`prompt-overview-panel.tsx` | UI composition, builds context, calls mutation. |
| **client/**<br>`use-agent-coder-api.ts` | Minimal bridge: constructs `Options`, invalidates cache, shows toasts. |
| **server/routes/**<br>`agent-coder-routes.ts` | HTTP boundary + error translation. |
| **server/services/**<br>`agent-coder-service.ts` | All agent functions + `mainOrchestrator`. |
| **server/services/**<br>`agent-tester-plugin.ts` | Test generation helper, Bun test execution, JUnit parsing. |
| **shared/schemas/** | `AgentCoderRunRequest`, `TaskPlan`, `CodeModificationPlan`, etc.—single truth for both sides. |

---

### TL;DR  
The Agent-Coder Service is a **self-contained, multi-agent pipeline** exposed through a single POST endpoint. The React client supplies a prompt and file IDs; the backend orchestrator delegates planning, (test updating), code-change planning, implementation, and optional test-driven retries. Every step is schema-driven for reliability, with state kept in memory and results returned so the UI can refresh the file tree. This design keeps concerns modular, leverages Bun’s integrated tooling, and provides a clear path for scaling to persistent storage or richer feedback loops.