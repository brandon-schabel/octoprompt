# OctoPrompt MCP Setup Guide

This guide explains how to set up OctoPrompt as a Model Context Protocol (MCP) server for use with Claude Desktop and other MCP-compatible clients.

## Overview

OctoPrompt provides an MCP server that exposes your project files and AI-powered features to Claude Desktop via stdio transport. This allows Claude to:

- Read files from your project
- List project files and structure
- Get AI-suggested files based on prompts
- Access project summaries

## Prerequisites

1. **Bun** - Make sure you have Bun installed
2. **OctoPrompt** - Have OctoPrompt running with at least one project created
3. **Claude Desktop** - Install Claude Desktop app

## Setup Steps

### 1. Find Your Project ID

First, you need to know which OctoPrompt project you want to expose to Claude. You can find project IDs by:

- Opening OctoPrompt web interface at `http://localhost:3147`
- Going to the Projects page
- The project ID is shown in the URL or project details

### 2. Configure Claude Desktop

Edit your Claude Desktop MCP configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the OctoPrompt MCP server configuration:

```json
{
  "mcpServers": {
    "octoprompt": {
      "command": "bun",
      "args": [
        "run",
        "mcp"
      ],
      "cwd": "/absolute/path/to/octoprompt/packages/server",
      "env": {
        "OCTOPROMPT_PROJECT_ID": "1"
      }
    }
  }
}
```

**Important**: Replace `/absolute/path/to/octoprompt/packages/server` with the actual absolute path to your OctoPrompt server directory.

### 3. Set Environment Variables

The MCP server needs to know which project to expose. Set the `OCTOPROMPT_PROJECT_ID` environment variable to your desired project ID (as shown in the config above).

### 4. Restart Claude Desktop

After updating the configuration, restart Claude Desktop for the changes to take effect.

## Available Tools

Once configured, Claude Desktop will have access to these OctoPrompt tools:

### `file_read`

Read the contents of a specific file in your project.

**Parameters**:

- `path` (string, required): File path relative to project root

**Example**: "Read the contents of src/components/App.tsx"

### `file_list`

List all files in your project directory.

**Parameters**:

- `path` (string, optional): Directory path to list (defaults to root)
- `recursive` (boolean, optional): Whether to list recursively

**Example**: "List all files in the src directory"

### `suggest_files`

Get AI-suggested files based on a prompt or task description.

**Parameters**:

- `prompt` (string, required): Description of what you're looking for
- `limit` (number, optional): Maximum files to suggest (default: 10)

**Example**: "Suggest files related to user authentication"

### `project_summary`

Get a summary of the project structure and contents.

**Parameters**:

- `include_files` (boolean, optional): Whether to include file summaries

**Example**: "Give me a project summary"

## Available Resources

The MCP server also exposes these resources:

- **Project Summary**: Overview of the project structure
- **File Suggestions**: AI-powered file suggestions (use the tool instead)
- **Individual Files**: Direct access to file contents via URI

## Troubleshooting

### Claude Desktop doesn't see the tools

1. **Check the configuration path**: Ensure the `cwd` path in your config is correct and absolute
2. **Verify Bun is in PATH**: Make sure Claude Desktop can find the `bun` command
3. **Check project ID**: Ensure the `OCTOPROMPT_PROJECT_ID` corresponds to an existing project
4. **Restart Claude Desktop**: Always restart after config changes

### "Project not found" errors

1. Make sure OctoPrompt server is running (`bun run dev:server` from the root)
2. Verify the project ID exists in OctoPrompt
3. Check that the project has been synced and contains files

### Permission errors

1. Ensure Claude Desktop has permission to execute Bun
2. Check that the OctoPrompt directory is readable
3. Verify file permissions on the project directory

## Testing the Connection

You can test the MCP server directly by running:

```bash
cd packages/server
bun run mcp
```

This will start the MCP server in stdio mode. You can send JSON-RPC messages to test functionality.

## Example Usage with Claude

Once set up, you can ask Claude things like:

- "What files are in this project?"
- "Read the main App component"
- "Show me files related to database connections"
- "Give me a summary of this project's structure"
- "Find files that handle user authentication"

Claude will use the MCP tools to access your OctoPrompt project and provide informed responses based on your actual codebase.

## Security Notes

- The MCP server only provides read access to your project files
- No write operations are exposed for security
- Only the specified project (by ID) is accessible
- Claude Desktop runs the MCP server as a child process with limited permissions

## Advanced Configuration

### Multiple Projects

To switch between projects, you can:

1. Change the `OCTOPROMPT_PROJECT_ID` in the config
2. Create multiple MCP server entries for different projects
3. Use different server names (e.g., "octoprompt-project1", "octoprompt-project2")

### Custom Port

If your OctoPrompt server runs on a different port, the MCP server will automatically connect to it via the services layer.

### Development Mode

For development, you can run the MCP server directly:

```bash
cd packages/server
OCTOPROMPT_PROJECT_ID=1 bun src/mcp-stdio-server.ts
```
