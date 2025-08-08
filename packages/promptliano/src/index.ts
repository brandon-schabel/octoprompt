#!/usr/bin/env node

import { Command } from 'commander'
import { setupCommand } from './commands/setup.js'
import { configCommand } from './commands/config.js'
import { updateCommand } from './commands/update.js'
import { doctorCommand } from './commands/doctor.js'
import { installCommand } from './commands/install.js'
import { uninstallCommand } from './commands/uninstall.js'
import { repairCommand } from './commands/repair.js'
import { serverCommand } from './commands/server.js'
import { displayVersionInfo } from './lib/version-display.js'
import packageJson from '../package.json' assert { type: 'json' }

const program = new Command()

// Display version info when no command is provided
const showVersionForDefault = process.argv.length === 2

program
  .name('promptliano')
  .description('Setup and manage Promptliano - Your AI toolkit for context engineering')
  .version(packageJson.version)
  .hook('preAction', async (thisCommand) => {
    // Show version info for default command or when explicitly running setup
    if (showVersionForDefault || thisCommand.args[0] === 'setup' || !thisCommand.args[0]) {
      await displayVersionInfo()
    }
  })

// Default command (interactive setup)
program.action(async () => {
  const { runInteractiveSetup } = await import('./commands/setup.js')
  await runInteractiveSetup()
})

// Register commands
setupCommand(program)
configCommand(program)
updateCommand(program)
doctorCommand(program)
installCommand(program)
uninstallCommand(program)
repairCommand(program)
serverCommand(program)

// Parse arguments
program.parse(process.argv)
