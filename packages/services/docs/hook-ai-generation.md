# AI-Powered Hook Generation

The Claude Hook Service now includes AI-powered generation of hook configurations from natural language descriptions.

## Usage

```typescript
import { claudeHookService } from '@promptliano/services'
import type { HookGenerationContext } from '@promptliano/services'

// Simple usage
const hook = await claudeHookService.generateHookFromDescription('automatically save files after editing')

// With context
const context: HookGenerationContext = {
  projectPath: '/path/to/project',
  suggestedEvent: 'PostToolUse',
  examples: ['git add .', 'npm test']
}

const hookWithContext = await claudeHookService.generateHookFromDescription('run tests before commits', context)
```

## API

### `generateHookFromDescription(description: string, context?: HookGenerationContext)`

Generates a complete hook configuration from a natural language description.

#### Parameters

- `description` (string): Natural language description of what the hook should do
- `context` (HookGenerationContext, optional):
  - `projectPath`: Current project path for context-aware suggestions
  - `suggestedEvent`: Pre-selected hook event if user has a preference
  - `examples`: Example commands to learn from

#### Returns

Returns a `CreateHookInput` object with additional fields:

- `event`: The hook event (PreToolUse, PostToolUse, etc.)
- `matcher`: Tool name pattern (regex supported)
- `hookConfig`: Complete hook configuration with command, timeout, etc.
- `configLevel`: Configuration level (defaults to 'project')
- `description`: Human-readable description
- `security_warnings`: Array of any security concerns

## Examples

### Auto-save Hook

```typescript
const autoSave = await claudeHookService.generateHookFromDescription('automatically commit changes after editing files')
// Result: PostToolUse hook matching "Edit|Write" tools
```

### Test Runner Hook

```typescript
const testRunner = await claudeHookService.generateHookFromDescription('run unit tests before allowing git commits', {
  suggestedEvent: 'PreToolUse'
})
// Result: PreToolUse hook that checks for git commit commands
```

### Session Logger

```typescript
const logger = await claudeHookService.generateHookFromDescription('log all Claude sessions to a file with timestamps')
// Result: SessionStart hook that logs to file
```

## Security

The AI is trained to:

- Avoid destructive commands (rm -rf, format, etc.)
- Validate file existence before operations
- Escape variables properly
- Set appropriate timeouts
- Warn about potential security issues

## Integration with Hook Service

After generating a hook, you can save it using the standard create method:

```typescript
const generated = await claudeHookService.generateHookFromDescription('lint JavaScript files after editing')

// Save the generated hook
const saved = await claudeHookService.createHook(projectPath, generated.configLevel, generated)
```
