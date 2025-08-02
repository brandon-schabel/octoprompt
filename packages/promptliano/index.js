#!/usr/bin/env node

console.log('🚀 Promptliano Setup Tool\n')

const args = process.argv.slice(2)
const command = args[0]

if (!command || command === 'help') {
  console.log('Usage: promptliano <command>\n')
  console.log('Commands:')
  console.log('  setup     - Set up Promptliano project')
  console.log('  config    - Configure MCP client')
  console.log('  help      - Show this help message')
  process.exit(0)
}

if (command === 'setup') {
  console.log('📦 Setting up Promptliano...')
  console.log('TODO: Download and install Promptliano')
  console.log('TODO: Initialize project')
  console.log('TODO: Start server')
} else if (command === 'config') {
  console.log('⚙️  Configuring MCP client...')
  console.log('TODO: Detect client type')
  console.log('TODO: Generate configuration')
  console.log('TODO: Apply configuration')
} else {
  console.log(`Unknown command: ${command}`)
  console.log('Run "promptliano help" for usage information')
  process.exit(1)
}
