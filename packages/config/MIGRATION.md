# Configuration Migration Guide

This guide helps migrate from scattered configuration imports to the centralized `@octoprompt/config` package.

## Migration Steps

### 1. Add @octoprompt/config Dependency

Add `"@octoprompt/config": "workspace:*"` to your package's dependencies.

### 2. Update Imports

#### Model Configurations

**Before:**
```typescript
import { LOW_MODEL_CONFIG, MEDIUM_MODEL_CONFIG, HIGH_MODEL_CONFIG } from '@octoprompt/schemas'
```

**After:**
```typescript
import { LOW_MODEL_CONFIG, MEDIUM_MODEL_CONFIG, HIGH_MODEL_CONFIG } from '@octoprompt/config'
```

#### File Sync Options

**Before:**
```typescript
import { ALLOWED_FILE_CONFIGS, DEFAULT_FILE_EXCLUSIONS } from '@octoprompt/schemas'
```

**After:**
```typescript
import { filesConfig } from '@octoprompt/config'
const { allowedExtensions, defaultExclusions } = filesConfig
```

#### Server Configuration

**Before:**
```typescript
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const SERVER_PORT = process.env.SERVER_PORT || 3147
```

**After:**
```typescript
import { getServerConfig } from '@octoprompt/config'
const { corsOrigin, serverPort } = getServerConfig()
```

#### Provider URLs

**Before:**
```typescript
const OPENAI_BASE_URL = 'https://api.openai.com/v1'
```

**After:**
```typescript
import { getProvidersConfig } from '@octoprompt/config'
const { openai } = getProvidersConfig()
const baseURL = openai.baseURL
```

### 3. Files to Update

The following files need to be updated to use @octoprompt/config:

- `packages/services/src/gen-ai-services.ts` - Model configurations
- `packages/services/src/model-providers/provider-defaults.ts` - Provider URLs
- `packages/server/server.ts` - Server configuration
- `packages/client/src/constants/server-constants.ts` - API URLs
- `packages/shared/src/constants/file-limits.ts` - File size limits
- Any other files importing model configs or file sync options

### 4. Testing

After migration:
1. Run `bun test:all` to ensure all tests pass
2. Start the dev server with `bun run dev`
3. Verify the application works correctly

### 5. Cleanup

Once migration is complete, remove the old configuration files:
- `packages/schemas/src/constants/model-default-configs.ts`
- `packages/schemas/src/constants/file-sync-options.ts`
- Other redundant configuration files