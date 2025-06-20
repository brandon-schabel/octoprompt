# MCP Integration Guide

OctoPrompt now supports the Model Context Protocol (MCP), allowing projects to integrate with external tools and resources through MCP servers.

## Overview

MCP (Model Context Protocol) is a standard protocol for connecting AI assistants to external tools and data sources. OctoPrompt's MCP integration allows you to:

- Configure and manage MCP servers per project
- Execute tools provided by MCP servers
- Access resources exposed by MCP servers
- Auto-start servers when projects open

## Architecture

### Backend Components

1. **Schemas** (`@octoprompt/schemas/src/mcp.schemas.ts`)
   - MCP server configuration schemas
   - Tool and resource schemas
   - Execution request/response schemas

2. **Storage** (`@octoprompt/storage/src/mcp-storage.ts`)
   - JSON-based storage for MCP configurations
   - Server state persistence
   - Project-specific MCP data management

3. **MCP Client** (`@octoprompt/mcp-client`)
   - Wrapper around the official MCP SDK
   - Server lifecycle management
   - Tool execution and resource access

4. **Services** (`@octoprompt/services/src/mcp-service.ts`)
   - High-level MCP operations
   - Server configuration CRUD
   - Tool/resource discovery and execution

5. **API Routes** (`@octoprompt/server/src/routes/mcp-routes.ts`)
   - RESTful endpoints for MCP operations
   - OpenAPI documentation

### Frontend Components

1. **React Hooks** (`packages/client/src/hooks/api/use-mcp-api.ts`)
   - Query and mutation hooks for MCP operations
   - Real-time server state updates

2. **UI Components**
   - `MCPServerDialog`: Add/edit MCP server configurations
   - `MCPServerList`: View and manage MCP servers
   - `MCPToolsPanel`: Browse and execute available tools
   - `MCPResourcesPanel`: Browse and view available resources
   - `MCPTabView`: Combined view for all MCP functionality

## Usage

### Adding an MCP Server

1. Navigate to a project and click the "MCP" tab
2. Click "Add Server" 
3. Configure the server:
   - **Name**: Display name for the server
   - **Command**: Command to start the server (e.g., `npx @modelcontextprotocol/server-filesystem`)
   - **Arguments**: Optional command line arguments
   - **Environment Variables**: Optional environment variables
   - **Enabled**: Whether the server can be started
   - **Auto-start**: Whether to start automatically when the project opens

### Managing Servers

- **Start/Stop**: Click the play/stop button to control server state
- **Edit**: Use the settings menu to edit configuration
- **Delete**: Remove servers from the settings menu
- **Status**: View real-time server status (stopped, starting, running, error)

### Using Tools

1. Start an MCP server that provides tools
2. Navigate to the "Tools" tab
3. Browse available tools with descriptions
4. Fill in required parameters
5. Click "Execute" to run the tool
6. View results in the output panel

### Accessing Resources

1. Start an MCP server that provides resources
2. Navigate to the "Resources" tab
3. Browse available resources
4. Click the eye icon to view resource content
5. Content is displayed in a modal dialog

## Example MCP Servers

### File System Server
```
Command: npx @modelcontextprotocol/server-filesystem
Arguments: --root /path/to/project
```
Provides file system access tools and resources.

### GitHub Server
```
Command: npx @modelcontextprotocol/server-github
Environment: GITHUB_TOKEN=your-token
```
Provides GitHub repository tools and resources.

### Custom Server
```
Command: node my-mcp-server.js
Arguments: --config ./config.json
```
Run your own MCP server implementation.

## Security Considerations

- MCP servers run as separate processes with the permissions of the OctoPrompt server
- Be cautious when configuring servers that access sensitive resources
- Review tool parameters before execution
- Environment variables are stored in plain text

## API Reference

### Endpoints

- `POST /api/projects/{projectId}/mcp-servers` - Create server config
- `GET /api/projects/{projectId}/mcp-servers` - List server configs
- `PATCH /api/projects/{projectId}/mcp-servers/{configId}` - Update config
- `DELETE /api/projects/{projectId}/mcp-servers/{configId}` - Delete config
- `POST /api/projects/{projectId}/mcp-servers/{configId}/start` - Start server
- `POST /api/projects/{projectId}/mcp-servers/{configId}/stop` - Stop server
- `GET /api/projects/{projectId}/mcp-tools` - List available tools
- `POST /api/projects/{projectId}/mcp-tools/execute` - Execute tool
- `GET /api/projects/{projectId}/mcp-resources` - List resources
- `GET /api/projects/{projectId}/mcp-resources/{serverId}?uri=...` - Read resource

## Development

### Adding New MCP Features

1. Update schemas in `@octoprompt/schemas`
2. Update storage if needed in `@octoprompt/storage`
3. Add service methods in `@octoprompt/services`
4. Create API routes in `@octoprompt/server`
5. Add React hooks in the client
6. Build UI components

### Testing MCP Servers

1. Install an MCP server: `npm install -g @modelcontextprotocol/server-filesystem`
2. Add it to a project in OctoPrompt
3. Start the server and verify tools/resources appear
4. Test tool execution and resource access

## Troubleshooting

- **Server won't start**: Check the command and ensure it's installed
- **No tools/resources**: Ensure the server is running (green status)
- **Execution errors**: Check server logs and parameter validation
- **Connection issues**: Verify the MCP server supports stdio transport