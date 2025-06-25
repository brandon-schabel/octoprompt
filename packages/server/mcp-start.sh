#!/bin/bash

# MCP Server startup script for OctoPrompt
# This script ensures the correct environment is set up

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Set default project ID if not provided
if [ -z "$OCTOPROMPT_PROJECT_ID" ]; then
    export OCTOPROMPT_PROJECT_ID=1
fi

# Add common bun installation paths to PATH
export PATH="/Users/$(whoami)/.bun/bin:$PATH"
export PATH="/opt/homebrew/bin:$PATH"
export PATH="/usr/local/bin:$PATH"

# Change to the server directory
cd "$SCRIPT_DIR"

# Try to find bun
if command -v bun >/dev/null 2>&1; then
    echo "Starting OctoPrompt MCP server with project ID: $OCTOPROMPT_PROJECT_ID" >&2
    exec bun run mcp
else
    echo "Error: bun not found in PATH" >&2
    echo "PATH: $PATH" >&2
    echo "Please install bun or update the PATH in this script" >&2
    exit 1
fi 