#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { devCommand } from './commands/dev.js';
import { downloadCommand } from './commands/download.js';
import { setupCommand } from './commands/setup.js';
import { configCommand } from './commands/config.js';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('promptliano')
  .description('Setup and manage Promptliano - Your AI toolkit for context engineering')
  .version('0.8.0');

// Register commands
devCommand(program);
downloadCommand(program);
setupCommand(program);
configCommand(program);
initCommand(program);

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}