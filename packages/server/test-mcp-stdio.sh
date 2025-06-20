#!/bin/bash

# Test MCP stdio server

echo "Testing MCP stdio server..."

# Test list tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | bun server.ts --mcp-stdio

# Test list resources  
echo '{"jsonrpc":"2.0","id":2,"method":"resources/list"}' | bun server.ts --mcp-stdio