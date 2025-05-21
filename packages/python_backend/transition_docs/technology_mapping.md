# Technology Mapping: TypeScript to Python Backend

This document outlines the transition of technologies from the original OctoPrompt TypeScript backend to the new Python backend. The primary goal is to achieve a 1:1 mapping of core functionalities and architectural concepts where feasible.

## Original Application Overview (TypeScript)

The OctoPrompt TypeScript backend, built with Bun and Hono, serves as a comprehensive toolkit for AI-assisted code development. Its key features include:

- **Project Management**: Synchronizing and managing multiple codebases.
- **AI Context Building**: Tools for selecting relevant files and prompts to optimize LLM input.
- **AI Agents**: Automated agents for tasks like code planning, file summarization, and intelligent file searching.
- **Integrated Chat**: Direct chat interface with various LLM providers (OpenRouter, OpenAI, Groq, local models via Ollama/LM Studio).
- **Prompt Library**: System for saving, managing, and reusing prompts.
- **Ticketing System**: For planning features and generating tasks, potentially with AI aid.
- **Local-First Design**: Operates primarily on the user's local machine with optional AI cloud features.
- **OpenAPI Specification**: Generates an API spec for clear documentation and client generation.

## Python Backend Migration Goals

The Python backend aims to replicate this functionality by mapping the original technology stack to Python equivalents:

| Feature/Component        | TypeScript Stack                  | Python Stack                      | Notes                                                                 |
| :----------------------- | :-------------------------------- | :-------------------------------- | :-------------------------------------------------------------------- |
| **Runtime Environment** | Bun                               | Python (3.10+)                    | Standard Python interpreter.                                          |
| **Web Framework** | Hono                              | FastAPI                           | Both are modern, high-performance ASGI frameworks.                    |
| **Data Validation** | Zod                               | Pydantic                          | Pydantic is the de-facto standard for data validation in Python.      |
| **AI SDK Integration** | TypeScript AI SDK (Vercel)        | Python AI SDK (Vercel)            | Provides a consistent interface for interacting with LLMs.            |
| **Package Management** | Bun (using `package.json`)        | Poetry / PDM (using `pyproject.toml`) | For managing dependencies and project packaging.                      |
| **API Specification** | Hono + `@hono/zod-openapi`        | FastAPI (native OpenAPI support)  | FastAPI automatically generates OpenAPI docs from Pydantic models.    |
| **Testing Framework** | `bun test` (Jest-like)            | Pytest                            | Pytest is a feature-rich and widely adopted testing framework.        |
| **Server Entry Point** | `packages/server/server.ts`       | `main.py`                         | Initializes and runs the FastAPI application using an ASGI server.    |
| **Application Setup** | `packages/server/src/app.ts`      | `main.py` / `app/core/config.py`  | FastAPI app setup, middleware, settings.                            |
| **Routing** | Hono Routes (`chat-routes.ts` etc.) | FastAPI Routers (`app/api/...`)   | Modular routing using `APIRouter`.                                  |
| **Services (Business Logic)** | `packages/server/src/services/`| `app/services/`                   | Layer for core business operations.                                   |
| **Shared Schemas/Utils** | `packages/shared/src/`            | Integrated into `app/schemas/`, `app/utils/` | Pydantic models and utilities will reside within the main app.        |
| **Storage Utilities** | `packages/server/src/utils/storage/`| `app/utils/storage/`              | Helper modules for interacting with local file-based storage.         |
| **Constants** | `.../constants/`                  | `app/constants/`                  | Storing application-wide constant values.                           |
| **Asynchronous Operations**| Promises, async/await             | asyncio, async/await              | Python's native asynchronous programming model.                       |

## Architectural Parity

The Python backend will strive to maintain a similar directory structure and separation of concerns as the TypeScript version:

- **API Layer (`app/api/`)**: Handles HTTP requests and responses, delegating to the service layer.
- **Service Layer (`app/services/`)**: Encapsulates business logic, orchestrating tasks and interacting with data/models.
- **Data Schemas (`app/schemas/`)**: Defines data structures and validation rules using Pydantic.
- **Utilities (`app/utils/`)**: Provides common helper functions.

This approach should make it easier for developers familiar with the TypeScript codebase to understand and contribute to the Python version. The transition leverages well-established Python libraries that offer functionalities analogous to their TypeScript counterparts, ensuring a robust and maintainable backend.
