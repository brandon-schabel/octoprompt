@echo off
REM MCP Server startup script for OctoPrompt on Windows
REM This script ensures the correct environment is set up

REM Set default project ID if not provided
if not defined OCTOPROMPT_PROJECT_ID (
    set OCTOPROMPT_PROJECT_ID=1750564533014
)

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

echo Starting OctoPrompt MCP server with project ID: %OCTOPROMPT_PROJECT_ID%
bun run mcp 