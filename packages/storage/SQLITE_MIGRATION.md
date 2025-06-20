# SQLite Storage Migration Guide

## Overview

The `prompt-storage.ts` and `provider-key-storage.ts` modules have been updated to use SQLite via the DatabaseManager instead of file-based JSON storage.

## Key Changes

### 1. Data Storage
- **Before**: JSON files in `data/prompt_storage/` and `data/provider_key_storage/`
- **After**: SQLite tables `prompts`, `prompt_projects`, and `provider_keys` in `data/octoprompt.db`

### 2. API Compatibility
All existing APIs remain the same for backward compatibility:
- `readPrompts()`, `writePrompts()` 
- `readPromptProjects()`, `writePromptProjects()`
- `readProviderKeys()`, `writeProviderKeys()`
- `generateId()`

### 3. New Methods Added

#### Prompt Storage
- `getPromptById(promptId)` - Get a specific prompt
- `upsertPrompt(prompt)` - Create or update a prompt
- `deletePrompt(promptId)` - Delete a prompt and its associations
- `getPromptsByProjectId(projectId)` - Get all prompts for a project
- `addPromptProjectAssociation(promptId, projectId)` - Link prompt to project
- `removePromptProjectAssociation(promptId, projectId)` - Unlink prompt from project

#### Provider Key Storage
- `getProviderKeyById(keyId)` - Get a specific key
- `upsertProviderKey(key)` - Create or update a key
- `deleteProviderKey(keyId)` - Delete a key
- `getKeysByProvider(provider)` - Get all keys for a provider
- `getActiveKeys()` - Get all active keys
- `getKeysByDateRange(startTime, endTime)` - Get keys by date range
- `countKeysByProvider(provider)` - Count keys for a provider

### 4. Performance Benefits
- Indexed queries for faster lookups
- Transaction support for atomic operations
- Better concurrency handling
- Reduced disk I/O

### 5. Migration Notes

#### ID Handling
- All IDs must be valid Unix timestamps in milliseconds
- Avoid using small numbers (< 10 billion) as they may be interpreted as seconds
- Use `Date.now()` or the provided `generateId()` method

#### Transactions
Write operations that modify multiple records are wrapped in transactions for consistency:
```typescript
// Example: writePrompts clears all prompts and inserts new ones atomically
await promptStorage.writePrompts(prompts)
```

#### Many-to-Many Relationships
Prompt-project associations use composite keys (`promptId_projectId`) for uniqueness.

## Data Migration

If you need to migrate existing JSON data to SQLite:

1. Read existing JSON files using the old file-based methods
2. Use the new `write*` methods to store in SQLite
3. Verify data integrity
4. Remove old JSON files

Example migration script:
```typescript
// This would need to be implemented based on your specific needs
async function migrateToSQLite() {
  // 1. Read from old JSON files
  const oldPrompts = await readJsonFile('data/prompt_storage/prompts.json')
  const oldAssociations = await readJsonFile('data/prompt_storage/prompt-projects.json')
  
  // 2. Write to SQLite
  await promptStorage.writePrompts(oldPrompts)
  await promptStorage.writePromptProjects(oldAssociations)
  
  // 3. Verify
  const newPrompts = await promptStorage.readPrompts()
  console.log('Migrated', Object.keys(newPrompts).length, 'prompts')
}
```

## Testing

Both storage modules maintain full backward compatibility. Existing code should work without changes. New features can be adopted incrementally.