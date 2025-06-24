# Claude Desktop MCP Configuration Options

Here are different ways to configure OctoPrompt with Claude Desktop. Choose the one that works best for you.

## Option 1: Shell Script (RECOMMENDED - Most Reliable)

```json
{
  "mcpServers": {
    "octoprompt": {
      "command": "/Users/brandon/Programming/octoprompt/packages/server/mcp-start.sh",
      "env": {
        "OCTOPROMPT_PROJECT_ID": "1"
      }
    }
  }
}
```

## Option 2: Direct Bun Script

```json
{
  "mcpServers": {
    "octoprompt": {
      "command": "/Users/brandon/.bun/bin/bun",
      "args": ["/Users/brandon/Programming/octoprompt/packages/server/mcp-direct.ts"],
      "env": {
        "OCTOPROMPT_PROJECT_ID": "1"
      }
    }
  }
}
```

## Option 3: Direct Path to Stdio Server

```json
{
  "mcpServers": {
    "octoprompt": {
      "command": "/Users/brandon/.bun/bin/bun",
      "args": ["/Users/brandon/Programming/octoprompt/packages/server/src/mcp-stdio-server.ts"],
      "env": {
        "OCTOPROMPT_PROJECT_ID": "1"
      }
    }
  }
}
```

## Troubleshooting

If you get "Script not found" errors:

1. **Use Option 1 (Shell Script)** - This is the most reliable approach
2. **Verify paths** - Make sure all file paths are absolute and correct
3. **Check permissions** - Ensure scripts are executable (`chmod +x`)
4. **Test manually** - Run the command from terminal to verify it works

## Testing Your Configuration

Before using with Claude Desktop, test the command manually:

```bash
# Test Option 1
/Users/brandon/Programming/octoprompt/packages/server/mcp-start.sh

# Test Option 2
/Users/brandon/.bun/bin/bun /Users/brandon/Programming/octoprompt/packages/server/mcp-direct.ts

# Test Option 3
/Users/brandon/.bun/bin/bun /Users/brandon/Programming/octoprompt/packages/server/src/mcp-stdio-server.ts
```

All should output: "OctoPrompt MCP server running on stdio"
