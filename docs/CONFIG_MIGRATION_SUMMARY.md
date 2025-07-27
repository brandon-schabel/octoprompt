# Configuration Migration Summary

## Overview

This document summarizes the migration of Promptliano's configuration system from scattered constants across multiple packages to a centralized `@promptliano/config` package.

## What Changed

### New Package: @promptliano/config

A new centralized configuration package was created at `packages/config` that consolidates all global settings:

- **Model Configurations**: AI model settings (LOW, MEDIUM, HIGH, PLANNING)
- **Provider Configurations**: Base URLs for all AI providers
- **Server Configurations**: Ports, CORS settings, environment detection
- **Files Configurations**: Allowed extensions, exclusion patterns, size limits
- **App Configurations**: Application metadata (name, version, description)

### Removed Files

The following duplicate configuration files were removed:

1. `/packages/schemas/src/constants/model-default-configs.ts`
2. `/packages/schemas/src/constants/file-sync-options.ts`
3. `/packages/services/src/constants/server-config.ts`

### Updated Imports

All imports were updated from:

```typescript
import { LOW_MODEL_CONFIG } from '@promptliano/schemas'
import { DEFAULT_FILE_EXCLUSIONS } from '@promptliano/schemas'
import { corsConfig } from '@promptliano/services/src/constants/server-config'
```

To:

```typescript
import { LOW_MODEL_CONFIG, getFilesConfig, getServerConfig } from '@promptliano/config'
```

### Files Modified

1. **packages/services/src/gen-ai-services.ts**
   - Updated model config imports
   - Replaced hardcoded Ollama/LMStudio URLs with config values

2. **packages/server/server.ts**
   - Updated to use centralized server config
   - Replaced local environment detection with config values

3. **packages/server/src/app.ts**
   - Updated CORS config import

4. **packages/schemas/src/chat.schemas.ts**
   - Updated model config import

5. **packages/schemas/src/gen-ai.schemas.ts**
   - Updated model config import

6. **packages/schemas/src/global-state-schema.ts**
   - Updated model config import

7. **packages/services/src/file-services/file-sync-service-unified.ts**
   - Updated file config imports

8. **packages/services/src/file-services/file-sync-service.test.ts**
   - Updated file config imports

### Benefits Achieved

1. **Single Source of Truth**: All configurations now in one place
2. **Type Safety**: Full TypeScript support with Zod validation
3. **Environment Flexibility**: Easy environment-specific overrides
4. **Reduced Duplication**: No more scattered constants
5. **Better Maintainability**: Easier to update configurations

### Environment Variables Supported

The following environment variables can override default settings:

- `DEFAULT_MODEL_PROVIDER` - Override the AI provider for all models
- `CORS_ORIGIN` - CORS origin setting
- `SERVER_HOST` - Server host
- `SERVER_PORT` - Server port
- `CLIENT_URL` - Client URL
- `API_URL` - API URL
- `OLLAMA_BASE_URL` - Ollama base URL
- `LMSTUDIO_BASE_URL` - LMStudio base URL
- `NODE_ENV` - Environment detection (development/test/production)
- `DOMAIN` - Domain for CORS configuration

### Future Improvements Identified

Based on the analysis, these configurations could be centralized in future iterations:

1. **Cache Configurations**: Multiple packages define their own cache settings
2. **UI Constants**: Breakpoints, panel sizes, zoom limits
3. **Retry/Timeout Configurations**: Standardize retry logic
4. **API Route Prefixes**: Define central API_PREFIX constant

## Testing

All tests have been updated and are passing. The configuration package includes its own test suite to ensure proper functionality.

## Usage Guide

To use the new configuration system:

```typescript
import {
  getGlobalConfig, // Get all configurations
  getModelsConfig, // Get model configurations
  getServerConfig, // Get server configurations
  getFilesConfig, // Get file configurations
  getProvidersConfig, // Get provider configurations
  LOW_MODEL_CONFIG, // Direct access to specific configs
  MEDIUM_MODEL_CONFIG,
  HIGH_MODEL_CONFIG
} from '@promptliano/config'
```

## Migration Checklist

- [x] Created @promptliano/config package
- [x] Migrated model configurations
- [x] Migrated provider configurations
- [x] Migrated server configurations
- [x] Migrated file configurations
- [x] Updated all imports across codebase
- [x] Removed duplicate configuration files
- [x] Updated package dependencies
- [x] Fixed circular dependency issues
- [x] All tests passing
- [x] Documentation updated
