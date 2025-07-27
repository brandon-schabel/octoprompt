@echo off
REM MCP Server startup script for Promptliano on Windows
REM This script ensures the correct environment is set up

REM Project ID is optional - if not set, server runs without project context

REM Add common bun installation paths to PATH if needed
REM Adjust these paths based on your Bun installation
set PATH=%PATH%;%USERPROFILE%\.bun\bin
set PATH=%PATH%;C:\Program Files\bun

REM Change to the server directory
cd /d "%~dp0"

REM Check for bun
where bun >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: bun not found in PATH
    echo PATH: %PATH%
    echo Please install bun or update the PATH in this script
    exit /b 1
)

if not defined PROMPTLIANO_PROJECT_ID (
    echo Starting Promptliano MCP server (no project context^)
) else (
    echo Starting Promptliano MCP server with project ID: %PROMPTLIANO_PROJECT_ID%
)
bun run mcp 