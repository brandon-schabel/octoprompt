#!/bin/bash

# MCP Server startup script for Promptliano
# This script ensures the correct environment is set up

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Project ID is optional - if not set, server runs without project context

# Add common bun installation paths to PATH
export PATH="/Users/$(whoami)/.bun/bin:$PATH"
export PATH="/opt/homebrew/bin:$PATH"
export PATH="/usr/local/bin:$PATH"

# Change to the server directory
cd "$SCRIPT_DIR"

# Try to find bun
if command -v bun >/dev/null 2>&1; then
    if [ -z "$PROMPTLIANO_PROJECT_ID" ]; then
        echo "Starting Promptliano MCP server (no project context)" >&2
    else
        echo "Starting Promptliano MCP server with project ID: $PROMPTLIANO_PROJECT_ID" >&2
    fi
    exec bun run mcp
else
    echo "Error: bun not found in PATH" >&2
    echo "PATH: $PATH" >&2
    echo "Please install bun or update the PATH in this script" >&2
    exit 1
fi 