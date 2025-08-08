# Promptliano CLI Package Guide

You are an expert CLI developer working on the Promptliano CLI package. This is the primary command-line interface for installing, configuring, and managing Promptliano across different development environments and editors.

## Package Overview

The Promptliano CLI is a Node.js/Bun-based command-line tool that:

- Installs and configures Promptliano for various editors (VS Code, Cursor, Windsurf, etc.)
- Manages MCP (Model Context Protocol) configurations
- Handles cross-platform path resolution and permissions
- Provides server management capabilities
- Offers diagnostic and repair utilities

### Core Architecture

```
packages/promptliano/
├── src/
│   ├── commands/          # CLI command implementations
│   │   ├── setup.ts       # Interactive setup wizard
│   │   ├── install.ts     # Installation command
│   │   ├── config.ts      # Configuration management
│   │   ├── doctor.ts      # System diagnostics
│   │   ├── server.ts      # Server management
│   │   ├── update.ts      # Update utilities
│   │   ├── repair.ts      # Repair and recovery
│   │   └── uninstall.ts   # Clean uninstallation
│   ├── lib/               # Core libraries and utilities
│   │   ├── mcp-configurator.ts    # MCP config generation
│   │   ├── editor-detector.ts     # Auto-detect editors
│   │   ├── cross-platform-paths.ts # Platform-specific paths
│   │   ├── permission-checker.ts   # Permission validation
│   │   └── server-manager.ts      # Server lifecycle
│   ├── services/          # Business logic services
│   │   ├── download.service.ts    # Binary downloads
│   │   ├── git.service.ts         # Git operations
│   │   ├── process.service.ts     # Process management
│   │   └── terminal.service.ts    # Terminal UI
│   └── types/             # TypeScript definitions
```

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze CLI patterns, error handling, and cross-platform compatibility
   - Ensure proper command structure and user experience

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on command separation and service abstraction

3. **Package-Specific Agents**
   - Use `node-cli-expert` for CLI architecture and patterns
   - Use `cross-platform-expert` for OS compatibility issues
   - Use `promptliano-mcp-tool-creator` for MCP configuration patterns
   - Use `terminal-ui-expert` for interactive prompts and output formatting

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about CLI commands and their impact
- Use multiple agents concurrently for maximum efficiency
- Test on multiple platforms when making path or permission changes

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Define configuration structures
2. **Storage layer** - N/A for CLI
3. **Services** - Implement command logic
4. **MCP tools** - Configure MCP for editors
5. **API routes** - N/A for CLI
6. **API client** - N/A for CLI
7. **React hooks** - N/A for CLI
8. **UI components** - Terminal UI components
9. **Page integration** - Command integration
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package handles the CLI interface for Promptliano installation and management, focusing on cross-platform compatibility, editor integration, and user experience.

## CLI Command Architecture

### Command Structure Pattern

Each command follows a consistent pattern:

```typescript
import { Command } from 'commander'
import { logger } from '../lib/logger.js'
import { handleError } from '../lib/errors.js'

export function myCommand(program: Command) {
  program
    .command('mycommand')
    .description('Clear description of what this command does')
    .option('-f, --force', 'Force operation without confirmation')
    .option('-v, --verbose', 'Verbose output')
    .action(async (options) => {
      try {
        logger.info('Starting operation...')

        // Validate environment
        await validatePrerequisites()

        // Execute command logic
        const result = await executeCommand(options)

        // Display success
        logger.success('Operation completed successfully')

        return result
      } catch (error) {
        handleError(error, 'Command failed')
        process.exit(1)
      }
    })
}
```

### Interactive Prompts Pattern

Use inquirer for interactive user input:

```typescript
import inquirer from 'inquirer'

async function promptUser() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'editor',
      message: 'Which editor are you using?',
      choices: [
        { name: 'VS Code', value: 'vscode' },
        { name: 'Cursor', value: 'cursor' },
        { name: 'Windsurf', value: 'windsurf' }
      ],
      default: detectDefaultEditor()
    },
    {
      type: 'confirm',
      name: 'installServer',
      message: 'Would you like to install the Promptliano server?',
      default: true
    }
  ])

  return answers
}
```

## Cross-Platform Support

### Path Resolution

Always use platform-aware path utilities:

```typescript
import { getCrossPlatformPaths } from '../lib/cross-platform-paths.js'

const paths = getCrossPlatformPaths()

// Platform-specific paths
const configPath = paths.getConfigPath('cursor') // ~/.cursor/config.json or %APPDATA%\Cursor\config.json
const dataPath = paths.getDataPath() // ~/.promptliano or %LOCALAPPDATA%\promptliano
```

### Permission Handling

Check and handle permissions appropriately:

```typescript
import { checkPermissions, requestElevation } from '../lib/permission-checker.js'

async function ensurePermissions(path: string) {
  const hasPermission = await checkPermissions(path)

  if (!hasPermission) {
    if (process.platform === 'win32') {
      await requestElevation('Permission required to modify configuration')
    } else {
      logger.warn('Run with sudo for system-wide installation')
    }
  }
}
```

## MCP Configuration Management

### Editor Configuration Pattern

Each editor has specific MCP configuration requirements:

```typescript
import { MCPConfigurator } from '../lib/mcp-configurator.js'

class EditorMCPConfig {
  async configureForEditor(editor: EditorType) {
    const configurator = new MCPConfigurator(editor)

    // Generate MCP configuration
    const config = configurator.generateConfig({
      serverPath: this.getServerPath(),
      workspaceRoot: process.cwd(),
      features: ['file-access', 'git-integration']
    })

    // Write to appropriate location
    await configurator.writeConfig(config)

    // Validate configuration
    await configurator.validate()
  }
}
```

### Configuration Schema

Use Zod for configuration validation:

```typescript
import { z } from 'zod'

const MCPConfigSchema = z.object({
  version: z.string(),
  servers: z.record(
    z.object({
      command: z.string(),
      args: z.array(z.string()),
      env: z.record(z.string()).optional()
    })
  )
})

// Always validate configurations
const validated = MCPConfigSchema.parse(config)
```

## Server Management

### Server Lifecycle

Manage server processes reliably:

```typescript
import { ServerManager } from '../lib/server-manager.js'

class PromptlianoServer {
  private manager: ServerManager

  async start(options: ServerOptions) {
    // Check if already running
    if (await this.manager.isRunning()) {
      logger.warn('Server is already running')
      return
    }

    // Start server process
    const process = await this.manager.start({
      port: options.port || 3579,
      detached: options.background,
      env: this.buildEnvironment(options)
    })

    // Wait for server to be ready
    await this.manager.waitForReady(process)

    logger.success(`Server started on port ${options.port}`)
  }

  async stop() {
    await this.manager.stop()
    logger.success('Server stopped')
  }
}
```

## Error Handling and Recovery

### Error Handling Pattern

Provide helpful error messages and recovery options:

```typescript
export class CLIError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestions?: string[]
  ) {
    super(message)
  }
}

export function handleError(error: unknown, context: string) {
  if (error instanceof CLIError) {
    logger.error(`${context}: ${error.message}`)

    if (error.suggestions?.length) {
      logger.info('\nSuggestions:')
      error.suggestions.forEach((s) => logger.info(`  • ${s}`))
    }

    if (error.code === 'PERMISSION_DENIED') {
      logger.info('\nTry running with elevated permissions:')
      logger.info('  sudo promptliano ' + process.argv.slice(2).join(' '))
    }
  } else {
    logger.error(`Unexpected error: ${error}`)
    logger.info('\nRun "promptliano doctor" to diagnose issues')
  }
}
```

### Diagnostic Tools

Implement comprehensive diagnostics:

```typescript
export class SystemDiagnostics {
  async runDiagnostics(): Promise<DiagnosticReport> {
    const checks = [
      this.checkNodeVersion(),
      this.checkBunInstallation(),
      this.checkEditorInstallations(),
      this.checkPermissions(),
      this.checkNetworkConnectivity(),
      this.checkExistingConfigurations()
    ]

    const results = await Promise.allSettled(checks)

    return this.generateReport(results)
  }

  async suggest Fixes(report: DiagnosticReport) {
    const fixes = []

    for (const issue of report.issues) {
      const fix = this.getSuggestedFix(issue)
      if (fix) fixes.push(fix)
    }

    return fixes
  }
}
```

## Testing CLI Commands

### Unit Testing Pattern

Test commands in isolation:

```typescript
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { Command } from 'commander'
import { setupCommand } from '../commands/setup'

describe('Setup Command', () => {
  let program: Command
  let mockLogger: any

  beforeEach(() => {
    program = new Command()
    mockLogger = {
      info: mock(),
      success: mock(),
      error: mock()
    }
  })

  test('should configure for VS Code', async () => {
    setupCommand(program)

    await program.parseAsync(['node', 'test', 'setup', '--editor', 'vscode'])

    expect(mockLogger.success).toHaveBeenCalledWith(expect.stringContaining('VS Code configuration complete'))
  })
})
```

### Integration Testing

Test full command flows:

```typescript
describe('CLI Integration', () => {
  test('full installation flow', async () => {
    // Run setup
    await runCommand('setup', ['--editor', 'cursor'])

    // Verify configuration created
    const configPath = getCrossPlatformPaths().getConfigPath('cursor')
    expect(await fileExists(configPath)).toBe(true)

    // Start server
    await runCommand('server', ['start', '--port', '3579'])

    // Verify server running
    const response = await fetch('http://localhost:3579/health')
    expect(response.ok).toBe(true)

    // Clean up
    await runCommand('server', ['stop'])
    await runCommand('uninstall', ['--force'])
  })
})
```

## Binary Management

### Download and Installation

Handle binary downloads reliably:

```typescript
import { DownloadService } from '../services/download.service.js'

class BinaryManager {
  async downloadAndInstall(version?: string) {
    const service = new DownloadService()

    // Determine platform and architecture
    const platform = this.getPlatform()
    const arch = this.getArchitecture()

    // Get download URL
    const url = await service.getBinaryUrl(platform, arch, version)

    // Download with progress
    await service.downloadWithProgress(url, {
      onProgress: (percent) => {
        logger.updateProgress(`Downloading: ${percent}%`)
      }
    })

    // Extract and install
    await this.extractBinary(downloadPath, installPath)

    // Set permissions
    if (platform !== 'win32') {
      await fs.chmod(installPath, 0o755)
    }
  }
}
```

## Best Practices

### 1. User Experience

- Provide clear, actionable error messages
- Use progress indicators for long operations
- Offer --verbose and --quiet flags
- Support --dry-run for testing
- Implement confirmation prompts for destructive operations

### 2. Cross-Platform Compatibility

- Test on Windows, macOS, and Linux
- Handle path separators correctly
- Account for permission differences
- Support both npm and Bun package managers

### 3. Configuration Management

- Validate all configurations with Zod
- Provide sensible defaults
- Support environment variable overrides
- Implement configuration migration for updates

### 4. Error Recovery

- Implement rollback for failed operations
- Provide repair commands
- Log errors for debugging
- Suggest fixes for common issues

### 5. Performance

- Use async operations for I/O
- Implement caching for repeated operations
- Minimize startup time
- Lazy load heavy dependencies

## Common Pitfalls to Avoid

1. **Hardcoded Paths** - Always use cross-platform path utilities
2. **Synchronous I/O** - Use async operations to prevent blocking
3. **Missing Error Handling** - Wrap all operations in try-catch
4. **Poor User Feedback** - Always inform user of progress
5. **Platform Assumptions** - Test on all target platforms
6. **Permission Issues** - Check permissions before operations
7. **Version Conflicts** - Handle multiple versions gracefully

## Integration with Other Packages

- Uses `@promptliano/shared` for utility functions
- Downloads and manages the server from `@promptliano/server`
- Configures MCP for the client from `@promptliano/client`
- Uses configuration schemas from `@promptliano/config`

This CLI package is the entry point for users to install and manage Promptliano, making it critical for the overall user experience and adoption of the platform.
