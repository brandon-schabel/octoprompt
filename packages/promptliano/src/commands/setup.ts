import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { PromptlianoSetup } from '../lib/setup.js';
import { logger } from '../lib/logger.js';

export function setupCommand(program: Command) {
  program
    .command('setup')
    .description('Setup Promptliano with guided installation')
    .option('--skip-download', 'Skip downloading Promptliano')
    .option('--skip-server', 'Skip starting the server')
    .option('--skip-mcp', 'Skip MCP configuration')
    .option('--install-path <path>', 'Custom installation path')
    .option('--editor <editor>', 'Specify editor (claude, vscode, cursor, windsurf, continue)')
    .option('--project <path>', 'Project path to configure')
    .action(async (options) => {
      try {
        const setup = new PromptlianoSetup();
        await setup.run(options);
      } catch (error) {
        logger.error('Setup failed:', error);
        process.exit(1);
      }
    });
}

export async function runInteractiveSetup() {
  // Version info is already displayed by the main command
  
  // Check for existing installation using the same logic as SystemChecker
  const defaultPath = join(homedir(), '.promptliano');
  const bundledServerPath = join(defaultPath, 'server.js');
  const sourceServerPath = join(defaultPath, 'packages', 'server');
  const hasExisting = existsSync(bundledServerPath) || existsSync(sourceServerPath);
  
  if (hasExisting) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Existing Promptliano installation found. What would you like to do?',
        choices: [
          { name: 'Configure MCP for a project', value: 'config' },
          { name: 'Update Promptliano', value: 'update' },
          { name: 'Reinstall Promptliano', value: 'reinstall' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);
    
    if (action === 'exit') {
      process.exit(0);
    }
    
    if (action === 'config') {
      const { configureProject } = await import('./config.js');
      await configureProject();
      return;
    }
    
    if (action === 'update') {
      const { updatePromptliano } = await import('./update.js');
      await updatePromptliano();
      return;
    }
  }
  
  // Simple installation questions - just the essentials
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'installPath',
      message: 'Where should Promptliano be installed?',
      default: defaultPath,
      validate: (input) => {
        if (!input) return 'Installation path is required';
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'installBun',
      message: 'Promptliano requires Bun. Install it now?',
      default: true,
      when: () => !process.env.BUN_INSTALL
    },
    {
      type: 'confirm',
      name: 'startServer',
      message: 'Start Promptliano server after installation?',
      default: true
    }
  ]);
  
  // Run setup - skip MCP configuration entirely for initial setup
  const setup = new PromptlianoSetup();
  await setup.run({
    installPath: answers.installPath,
    skipDownload: false,
    skipServer: !answers.startServer,
    skipMcp: true, // Always skip MCP for initial setup
    installBun: answers.installBun
  });
  
  // Success message
  console.log(chalk.green.bold('\n✅ Promptliano installed successfully!\n'));
  
  if (answers.startServer) {
    console.log(chalk.cyan('🌐 Server is running at:'), chalk.bold('http://localhost:3579'));
    console.log(chalk.gray('   The server runs in the background.\n'));
    
    console.log(chalk.cyan('Server management commands:'));
    console.log('  •', chalk.bold('promptliano server stop'), '    - Stop the server');
    console.log('  •', chalk.bold('promptliano server status'), '  - Check server status');
    console.log('  •', chalk.bold('promptliano server restart'), ' - Restart the server\n');
  }
  
  console.log(chalk.cyan('Next steps:'));
  console.log('  1. Run', chalk.bold('promptliano config'), 'to configure MCP for your AI editor');
  console.log('  2. Run', chalk.bold('promptliano doctor'), 'to check system health');
  console.log('  3. Visit https://promptliano.com for documentation');
  console.log('\nHappy coding! 🚀\n');
}