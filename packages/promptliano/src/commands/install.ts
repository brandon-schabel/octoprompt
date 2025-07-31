import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { PromptlianoSetup } from '../lib/setup.js';
import { BackupManager } from '../lib/backup-manager.js';
import { PermissionChecker } from '../lib/permission-checker.js';
import { logger } from '../lib/logger.js';

export interface InstallOptions {
  path?: string;
  force?: boolean;
  skipBackup?: boolean;
  skipServer?: boolean;
  skipMcp?: boolean;
  clean?: boolean;
  branch?: string;
}

export function installCommand(program: Command) {
  program
    .command('install')
    .description('Install Promptliano with advanced options')
    .option('-p, --path <path>', 'Installation path')
    .option('-f, --force', 'Force installation even if already exists')
    .option('--skip-backup', 'Skip backing up existing installation')
    .option('--skip-server', 'Skip starting the server after installation')
    .option('--skip-mcp', 'Skip MCP configuration')
    .option('--clean', 'Perform clean installation (remove existing)')
    .option('--branch <branch>', 'Install from specific branch', 'main')
    .action(async (options: InstallOptions) => {
      try {
        await runInstall(options);
      } catch (error) {
        logger.error('Installation failed:', error);
        process.exit(1);
      }
    });
}

export async function runInstall(options: InstallOptions = {}) {
  console.log(chalk.bold.cyan('\n📦 Promptliano Installation\n'));

  // Determine installation path
  const installPath = options.path || join(homedir(), '.promptliano');
  const exists = existsSync(installPath);

  // Check if installation already exists
  if (exists && !options.force && !options.clean) {
    console.log(chalk.yellow('⚠️  Promptliano is already installed at:'), installPath);
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Backup and reinstall', value: 'backup' },
          { name: 'Clean install (remove existing)', value: 'clean' },
          { name: 'Cancel', value: 'cancel' }
        ]
      }
    ]);

    if (action === 'cancel') {
      console.log(chalk.gray('Installation cancelled'));
      return;
    }

    if (action === 'backup') {
      options.clean = true;
    } else if (action === 'clean') {
      options.clean = true;
      options.skipBackup = true;
    }
  }

  // Check permissions
  const permissionChecker = new PermissionChecker();
  const permSpinner = ora('Checking permissions...').start();
  
  const permCheck = await permissionChecker.checkInstallPermissions(installPath);
  if (!permCheck.canWrite) {
    permSpinner.fail('Insufficient permissions');
    console.log(chalk.red(`❌ Cannot write to ${installPath}`));
    console.log(chalk.yellow('Try running with sudo or choose a different path'));
    process.exit(1);
  }
  permSpinner.succeed('Permissions verified');

  // Backup existing installation if needed
  if (exists && !options.skipBackup) {
    const backupManager = new BackupManager();
    const backupSpinner = ora('Backing up existing installation...').start();
    
    try {
      const backupPath = await backupManager.backup(installPath, {
        includeData: true,
        includeLogs: false
      });
      backupSpinner.succeed(`Backup saved to ${backupPath}`);
    } catch (error) {
      backupSpinner.fail('Backup failed');
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Continue without backup?',
          default: false
        }
      ]);
      
      if (!proceed) {
        console.log(chalk.gray('Installation cancelled'));
        return;
      }
    }
  }

  // Clean existing installation if requested
  if (exists && options.clean) {
    const cleanSpinner = ora('Removing existing installation...').start();
    try {
      await rm(installPath, { recursive: true, force: true });
      cleanSpinner.succeed('Existing installation removed');
    } catch (error) {
      cleanSpinner.fail('Failed to remove existing installation');
      throw error;
    }
  }

  // Perform installation
  const setup = new PromptlianoSetup();
  const installOptions = {
    installPath,
    skipServer: options.skipServer,
    skipMcp: options.skipMcp,
    branch: options.branch
  };

  console.log(chalk.cyan('\n📥 Installing Promptliano...'));
  console.log(chalk.gray(`Installation path: ${installPath}`));
  console.log(chalk.gray(`Branch: ${options.branch || 'main'}`));

  const result = await setup.install(installOptions);

  if (result.success) {
    console.log(chalk.green('\n✅ Installation complete!'));
    
    if (!options.skipServer && result.serverStarted) {
      console.log(chalk.cyan(`🚀 Server running on port ${result.port}`));
    }
    
    if (!options.skipMcp) {
      console.log(chalk.cyan('\n📋 Next steps:'));
      console.log('  1. Run', chalk.bold('promptliano config'), 'to configure your AI editor');
      console.log('  2. Run', chalk.bold('promptliano doctor'), 'to verify installation');
    }
    
    console.log(chalk.gray(`\nInstalled at: ${installPath}`));
  } else {
    console.log(chalk.red(`\n❌ Installation failed: ${result.error}`));
    process.exit(1);
  }
}

// Extension to PromptlianoSetup for install method
declare module '../lib/setup.js' {
  interface PromptlianoSetup {
    install(options: {
      installPath: string;
      skipServer?: boolean;
      skipMcp?: boolean;
      branch?: string;
    }): Promise<{
      success: boolean;
      error?: string;
      serverStarted?: boolean;
      port?: number;
    }>;
  }
}