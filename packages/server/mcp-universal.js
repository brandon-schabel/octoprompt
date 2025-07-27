#!/usr/bin/env node
/**
 * Universal MCP launcher that works on all platforms
 * This script finds and runs bun with the HTTP bridge
 */

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

// Possible bun locations
const bunPaths = [
  'bun', // In PATH
  path.join(os.homedir(), '.bun', 'bin', 'bun'), // Unix/Mac default
  path.join(process.env.USERPROFILE || '', '.bun', 'bin', 'bun.exe'), // Windows user
  '/usr/local/bin/bun', // Mac/Linux global
  '/opt/homebrew/bin/bun', // Mac homebrew
  'C:\\Program Files\\bun\\bun.exe' // Windows global
]

// Find bun executable
function findBun() {
  // First try the command directly (if in PATH)
  try {
    const result = require('child_process').execSync('bun --version', { stdio: 'pipe' })
    if (result) return 'bun'
  } catch (e) {
    // Not in PATH, continue searching
  }

  // Try specific paths
  for (const bunPath of bunPaths) {
    if (bunPath && fs.existsSync(bunPath)) {
      return bunPath
    }
  }

  return null
}

const bunPath = findBun()

if (!bunPath) {
  console.error('Error: bun not found. Please install bun from https://bun.sh')
  console.error('Searched in:', bunPaths)
  process.exit(1)
}

// Get the directory of this script
const scriptDir = __dirname
const bridgeScript = path.join(scriptDir, 'mcp-http-bridge.ts')

// Pass through environment variables
const env = {
  ...process.env,
  MCP_HTTP_URL: process.env.MCP_HTTP_URL || 'http://localhost:3147/api/mcp',
  PROMPTLIANO_PROJECT_ID: process.env.PROMPTLIANO_PROJECT_ID,
  MCP_DEBUG: process.env.MCP_DEBUG
}

// Spawn bun with the bridge script
const child = spawn(bunPath, ['run', bridgeScript], {
  env,
  stdio: 'inherit', // This is crucial for stdio communication
  cwd: scriptDir
})

child.on('error', (err) => {
  console.error('Failed to start MCP bridge:', err)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code || 0)
})
