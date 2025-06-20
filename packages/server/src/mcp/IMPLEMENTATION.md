# MCP Server Implementation

## Overview

This MCP (Model Context Protocol) server implementation provides tools and resources for AI assistants to interact with OctoPrompt projects.

## Architecture

### Components

1. **server.ts** - Core MCP server with tool and resource handlers
   - Singleton server instance
   - Tool handlers for browsing files, getting content, project summaries, prompts
   - Resource handlers for project structure

2. **transport.ts** - Transport layer implementations
   - Stdio transport for Claude Desktop (fully implemented)
   - HTTP/SSE transport for Cursor (placeholder - requires Hono adaptation)
   - Session management for HTTP connections

3. **mcp-routes.ts** - HTTP API endpoints
   - Extended existing routes with MCP-specific endpoints
   - Session management endpoints
   - Placeholder for SSE message handling

## Tools Implemented

1. **browse_project_files**
   - Browse project file structure
   - Optional path parameter to filter by directory
   - Returns directory tree or file list

2. **get_file_content**
   - Get content of a specific file
   - Supports text and image files
   - Images returned as base64-encoded data

3. **get_project_summary**
   - Comprehensive project summary
   - Uses existing summary generation service
   - Includes structure, stats, and key files

4. **list_prompts**
   - List all prompts or filter by project
   - Returns prompt metadata

5. **get_prompt**
   - Get specific prompt by ID
   - Returns full prompt content

## Resources Implemented

- **octoprompt://project/{id}/structure** - Project file structure and organization

## Transport Support

### Stdio Transport (Working)
- Full bidirectional communication via stdin/stdout
- Compatible with Claude Desktop
- Run with: `bun server.ts --mcp-stdio`

### HTTP/SSE Transport (Partial)
- Basic endpoint structure in place
- Session management implemented
- Actual SSE streaming requires Hono-to-Node.js response adapter
- Endpoints:
  - GET `/api/mcp` - MCP server info
  - GET `/api/projects/{projectId}/mcp` - Project-scoped MCP
  - POST `/api/mcp/messages` - Message handling (not implemented)
  - GET `/api/mcp/sessions` - List active sessions
  - DELETE `/api/mcp/sessions/{sessionId}` - Close session

## Integration Points

- Uses existing ProjectService for project data
- Uses existing PromptService for prompt data
- Leverages file storage system for content retrieval
- Integrates with project summary utilities

## Configuration

### Claude Desktop
```json
{
  "mcpServers": {
    "octoprompt": {
      "command": "bun",
      "args": ["/path/to/octoprompt/packages/server/server.ts", "--mcp-stdio"]
    }
  }
}
```

### Package.json Script
```json
{
  "scripts": {
    "mcp:stdio": "bun server.ts --mcp-stdio"
  }
}
```

## Future Enhancements

1. **Complete SSE Transport**
   - Implement proper Hono-to-Node.js response handling
   - Add message routing for POST requests
   - Enable real-time tool execution via HTTP

2. **Additional Tools**
   - File modification capabilities
   - Project search functionality
   - Code analysis tools

3. **Enhanced Resources**
   - File content resources
   - Prompt collection resources
   - Project statistics resources

4. **Security**
   - Add authentication for HTTP transport
   - Implement permission scoping per session
   - Rate limiting for tool execution

## Testing

Test stdio mode:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | bun run mcp:stdio
```

Test HTTP endpoint:
```bash
curl http://localhost:3147/api/mcp
```