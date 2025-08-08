# Promptliano CLI

[![npm version](https://img.shields.io/npm/v/promptliano.svg)](https://www.npmjs.com/package/promptliano)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/promptliano.svg)](https://nodejs.org)

Quick setup and management tool for Promptliano - Your AI toolkit for context engineering.

## Overview

The Promptliano CLI provides a streamlined way to install, configure, and manage Promptliano on your system. It handles the complete setup process including downloading the server, configuring MCP (Model Context Protocol) for your AI editor, and managing the Promptliano server lifecycle.

## Installation

### Quick Start with npx (Recommended)

```bash
npx promptliano@latest
```

> **Note:** Using `@latest` ensures you always run the most recent version of the CLI. No installation required!

### Global Installation

```bash
# Using npm
npm install -g promptliano

# Using yarn
yarn global add promptliano

# Using bun
bun add -g promptliano
```

## Quick Start

1. **Run the interactive setup:**

   ```bash
   npx promptliano@latest
   ```

   Or if installed globally:

   ```bash
   promptliano
   ```

2. **Follow the prompts to:**
   - Download and install Promptliano server
   - Configure MCP for your AI editor (Claude, Cursor, etc.)
   - Start the Promptliano server
   - Create your first project

3. **Access Promptliano UI:**
   Open [http://localhost:3579](http://localhost:3579) in your browser

## Commands

### `promptliano`

Run interactive setup wizard (default command).

```bash
promptliano
```

### `promptliano setup`

Perform guided installation with options.

```bash
promptliano setup [options]

Options:
  --skip-download      Skip downloading Promptliano server
  --skip-server        Skip starting the server
  --skip-mcp          Skip MCP configuration
  --install-path <path>  Custom installation path (default: ~/.promptliano)
  --editor <editor>    Specify editor (claude, vscode, cursor, windsurf, continue)
  --project <path>     Project path to configure
```

Example:

```bash
promptliano setup --editor cursor --project /path/to/my-project
```

### `promptliano config`

Configure MCP for your AI editor.

```bash
promptliano config [options]

Options:
  -e, --editor <editor>  Editor to configure (claude, vscode, cursor, windsurf, continue)
  -p, --project <path>   Project path
  --remove               Remove MCP configuration
```

Example:

```bash
promptliano config --editor claude --project ./my-project
```

### `promptliano server`

Manage the Promptliano server.

```bash
# Check server status
promptliano server

# Start server
promptliano server start [options]

Options:
  -p, --port <port>  Port to run on (default: 3579)
  -d, --detached     Run in background (default: true)
  -f, --foreground   Run in foreground

# Stop server
promptliano server stop

# Restart server
promptliano server restart

# Show server logs
promptliano server logs [options]

Options:
  -f, --follow  Follow log output
  -n <lines>    Number of lines to show (default: 50)
```

### `promptliano update`

Update Promptliano to the latest version.

```bash
promptliano update [options]

Options:
  --check  Check for updates without installing
  --force  Force update even if on latest version
```

### `promptliano doctor`

Diagnose and fix common issues.

```bash
promptliano doctor [options]

Options:
  --fix  Attempt to fix issues automatically
```

The doctor command checks:

- Node.js and Bun versions
- Installation integrity
- Server connectivity
- MCP configurations
- File permissions
- Port availability

### `promptliano repair`

Advanced repair tool for fixing installation issues.

```bash
promptliano repair [options]

Options:
  -p, --path <path>      Installation path to repair
  --fix-permissions      Fix file and directory permissions
  --fix-mcp             Repair MCP configurations
  --fix-dependencies    Reinstall dependencies
  --no-backup           Skip backup before repair
  -f, --force           Force repair without prompts
```

### `promptliano install`

Install additional Promptliano components.

```bash
promptliano install [component]

Components:
  server    Install/reinstall the Promptliano server
  mcp       Install MCP configurations
```

### `promptliano uninstall`

Uninstall Promptliano from your system.

```bash
promptliano uninstall [options]

Options:
  --keep-config  Keep configuration files
  --keep-data    Keep project data
  -f, --force    Force uninstall without prompts
```

## Supported AI Editors

The CLI can configure MCP (Model Context Protocol) for the following AI editors:

- **Claude Desktop** - Anthropic's Claude AI assistant
- **Cursor** - AI-powered code editor
- **VS Code** - With Continue extension
- **Windsurf** - Codeium's AI editor
- **Continue** - Open-source AI code assistant

## Configuration

### MCP Configuration Paths

The CLI automatically configures MCP in the appropriate location for each editor:

- **Claude Desktop:**
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

- **Cursor:**
  - macOS: `~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
  - Windows: `%APPDATA%\Cursor\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`

- **VS Code:**
  - macOS: `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
  - Windows: `%APPDATA%\Code\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`

### Environment Variables

- `PROMPTLIANO_HOME` - Override default installation path
- `PROMPTLIANO_PORT` - Override default server port (3579)
- `PROMPTLIANO_LOG_LEVEL` - Set log level (debug, info, warn, error)

## Troubleshooting

### Common Issues

1. **"Command not found" after installation:**
   - Ensure npm/yarn global bin directory is in your PATH
   - Try using `npx promptliano` instead

2. **Server won't start:**
   - Check if port 3579 is already in use
   - Run `promptliano doctor` to diagnose issues
   - Try `promptliano server restart`

3. **MCP not working in editor:**
   - Restart your AI editor after configuration
   - Verify configuration with `promptliano doctor`
   - Check editor-specific MCP settings

4. **Permission errors:**
   - Run `promptliano repair --fix-permissions`
   - On macOS/Linux, you may need to use `sudo` for global installation

### Debug Mode

Enable debug logging for troubleshooting:

```bash
PROMPTLIANO_LOG_LEVEL=debug promptliano doctor
```

## System Requirements

- **Node.js**: >= 18.0.0
- **Operating Systems**: macOS, Windows, Linux
- **Memory**: 512MB RAM minimum
- **Disk Space**: 100MB for installation

### Optional Requirements

- **Bun**: For better performance (automatically installed if not present)
- **Git**: For cloning projects

## Development

### Running from Source

```bash
# Clone the repository
git clone https://github.com/brandon-schabel/promptliano.git
cd promptliano/packages/promptliano

# Install dependencies
bun install

# Run CLI in development
bun run dev

# Run tests
bun test

# Build for production
bun run build
```

### Testing Locally

```bash
# Run the test script
./test-local.sh

# Or manually test commands
bun run src/index.ts --help
bun run src/index.ts doctor
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- **Documentation**: [promptliano.com](https://promptliano.com)
- **Issues**: [GitHub Issues](https://github.com/brandon-schabel/promptliano/issues)
- **Discord**: [Join our community](https://discord.gg/promptliano)

## License

MIT License - see the [LICENSE](../../LICENSE) file for details.

## Acknowledgments

Built with:

- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/) - Interactive prompts
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [Ora](https://github.com/sindresorhus/ora) - Terminal spinners

---

Made with ❤️ by the Promptliano team
