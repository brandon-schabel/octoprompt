# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

- `bun run dev` - Start both client and server in development mode
- `bun run dev:client` - Start only client (port 5173)
- `bun run dev:server` - Start only server (port 3147)

### Testing

- `bun run test:server` - Run server tests
- `bun run test:shared` - Run shared package tests
- `bun run test:schemas` - Run schema tests

### Production Build

- `bun run build-binaries` - Build cross-platform binaries
- `bun run format` - Format all code with Prettier

## Architecture

OctoPrompt is a TypeScript monorepo using Bun with workspace packages for modular development. The codebase follows a layered architecture pattern:

### Core Structure

- **Client**: React 19 + Vite frontend with ShadCN UI components, TanStack Router/Query
- **Server**: Bun + Hono backend with OpenAPI specs and file-based JSON storage
- **Schemas**: Zod schemas shared between client/server for type safety
- **Services**: Business logic layer orchestrating storage operations
- **Storage**: JSON file persistence with atomic operations and validation

### Data Flow

1. **API Layer** (`packages/server/src/routes/`) - Hono routes with OpenAPI validation
2. **Services Layer** (`packages/services/src/`) - Business logic and orchestration
3. **Storage Layer** (`packages/storage/src/`) - JSON file operations with Zod validation

### Key Patterns

- **Unix millisecond timestamps** for all IDs, created/updated fields
- **Route ordering matters** in Hono - most specific routes first
- **Schema-first development** - all types derived from Zod schemas via `z.infer<>`
- **Monorepo workspace imports** using `@octoprompt/*` namespaces

### AI Integration

Multi-provider AI support via Vercel AI SDK with configurable model defaults in `packages/shared/src/constants/model-default-configs.ts`. File summarization, code generation, and chat functionality throughout the application.

### File Synchronization

Real-time project file watching and synchronization with Git-aware ignore patterns. Project files are indexed and summarized for AI context building.

## Development Guidelines

### TypeScript Standards

- Use strong typing, avoid `any`
- Leverage Zod schemas for validation and type inference
- Prefer functional programming patterns
- Write testable, single-responsibility functions

### Error Handling

- Use custom `ApiError` class for consistent API responses
- Global error handler in `app.ts` catches and formats errors
- Validate data at storage and API boundaries

### Testing

- Unit tests for services with mocked storage
- Functional API tests against running server
- Use `bun:test` framework throughout

### ID Generation

Storage layers use `generateId()` which returns Unix milliseconds, with collision handling by incrementing until unique.
