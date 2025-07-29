@echo off
setlocal EnableDelayedExpansion
REM MCP Server startup script for Promptliano on Windows
REM This script ensures the correct environment is set up

REM Debug: Show current directory
echo Current directory: %CD% 1>&2
echo Script directory: %~dp0 1>&2

REM Project ID is optional - if not set, server runs without project context

REM Add common bun installation paths to PATH if needed
REM Using quotes to handle spaces and special characters
set "PATH=%PATH%;%USERPROFILE%\.bun\bin"
set "PATH=%PATH%;C:\Program Files\bun"

REM Change to the server directory
cd /d "%~dp0"
echo Changed to: %CD% 1>&2

REM Check for bun
where bun >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo Error: bun not found in PATH
    echo Please install bun or update the PATH in this script
    exit /b 1
)

if not defined PROMPTLIANO_PROJECT_ID (
    echo Starting Promptliano MCP server - no project context
) else (
    echo Starting Promptliano MCP server with project ID: !PROMPTLIANO_PROJECT_ID!
)

REM Run the MCP server
bun run mcp 