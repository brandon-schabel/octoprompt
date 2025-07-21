# @octoprompt/config

Centralized configuration management for OctoPrompt.

## Overview

This package provides a single source of truth for all global configuration in the OctoPrompt application. It consolidates settings that were previously scattered across multiple files and packages.

## Configuration Domains

### App Configuration
- Application name, version, and description
- Located in `src/configs/app.config.ts`

### Server Configuration
- CORS settings, ports, and URLs
- Environment-aware with automatic override support
- Located in `src/configs/server.config.ts`

### Model Configuration
- AI model settings for LOW, MEDIUM, HIGH, and PLANNING tiers
- Includes provider, temperature, token limits, and other parameters
- Located in `src/configs/models.config.ts`

### Provider Configuration
- Base URLs for all AI providers (OpenAI, Anthropic, Google, etc.)
- Located in `src/configs/providers.config.ts`

### Files Configuration
- Allowed file extensions for sync
- Default exclusion patterns
- File size and token limits
- Located in `src/configs/files.config.ts`

## Usage

```typescript
import { 
  getGlobalConfig,
  getModelsConfig,
  LOW_MODEL_CONFIG,
  filesConfig,
  providersConfig
} from '@octoprompt/config'

// Get entire configuration
const config = getGlobalConfig()

// Get specific domain
const models = getModelsConfig()

// Use individual configs directly
const lowModel = LOW_MODEL_CONFIG
const allowedExtensions = filesConfig.allowedExtensions
```

## Environment Variables

The following environment variables can override default settings:

- `DEFAULT_MODEL_PROVIDER` - Override AI provider for all models
- `CORS_ORIGIN` - CORS origin (default: *)
- `SERVER_HOST` - Server host (default: localhost)
- `SERVER_PORT` - Server port (default: 3147)
- `CLIENT_URL` - Client URL (default: http://localhost:1420)
- `API_URL` - API URL (default: http://localhost:3147)

## Configuration Validation

All configurations are validated using Zod schemas to ensure type safety and runtime correctness. Invalid configurations will throw an error at startup.

## Future Enhancements

This configuration system is designed to grow with the application. Future features may include:

- Runtime configuration updates via UI
- Configuration persistence to database
- User-specific configuration overrides
- Configuration versioning and migrations
- Export/import configuration settings