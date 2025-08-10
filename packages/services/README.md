## CI TypeScript Fix Plan (Services)

1. Scope typecheck

- Use `packages/services/tsconfig.json` to exclude tests and test utils.
- Add local shims for `@promptliano/shared` and `@promptliano/storage` types used only for compile.

2. Align with schemas

- Update `queue` helpers/tests to camelCase fields (`queueId`, `queueStatus`, `queuedAt`).
- Replace removed enums (`QueueItemStatus` -> `ItemQueueStatus`).

3. Unsafe optional fixes

- Narrow or default optional fields (e.g., token savings, summaries) before use.

4. Project summary options

- Pass mandatory `groupAware`, `includeRelationships`, `contextWindow` to summary helpers.

5. Iterative TS run

- Run `bun run typecheck:services` until green.

6. Follow-ups (separate PRs)

- Remove temporary shims by importing exact types/functions from `shared`/`storage` once stabilized.
- Re-enable tests with dedicated test tsconfig.

# ai

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.8. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
