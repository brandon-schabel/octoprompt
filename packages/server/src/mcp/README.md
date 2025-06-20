# OctoPrompt MCP Server

This directory contains the Model Context Protocol (MCP) server implementation for OctoPrompt.

## Overview

The MCP server provides tools and resources for AI assistants to interact with OctoPrompt projects:

### Tools

- `browse_project_files` - Browse and explore files in a project
- `get_file_content` - Get the content of a specific file in a project
- `get_project_summary` - Get a comprehensive summary of a project
- `list_prompts` - List all prompts, optionally filtered by project
- `get_prompt` - Get a specific prompt by ID

### Resources

- `octoprompt://project/{id}/structure` - Project file structure and organization

## Transport Support

The server supports two transport modes:

### 1. HTTP/SSE Transport (for Cursor)

Start the normal server and access MCP via HTTP:

```bash
bun run dev
```

MCP endpoints:
- `GET /api/mcp` - General MCP access
- `GET /api/projects/{projectId}/mcp` - Project-specific MCP access
- `GET /api/mcp/sessions` - List active sessions
- `DELETE /api/mcp/sessions/{sessionId}` - Close a session

### 2. Stdio Transport (for Claude Desktop)

Start the server in stdio mode:

```bash
bun run mcp:stdio
```

Or directly:

```bash
bun server.ts --mcp-stdio
```

## Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "octoprompt": {
      "command": "bun",
      "args": ["/path/to/octoprompt/packages/server/server.ts", "--mcp-stdio"],
      "env": {}
    }
  }
}
```

Replace `/path/to/octoprompt` with the actual path to your OctoPrompt installation.

## Cursor Configuration

In Cursor, add the MCP server URL:

```
http://localhost:3147/api/mcp
```

Or for project-specific context:

```
http://localhost:3147/api/projects/{projectId}/mcp
```

## Architecture

- `server.ts` - Main MCP server with tool and resource handlers
- `transport.ts` - Transport handlers for HTTP/SSE and stdio
- Integration with existing OctoPrompt services for data access