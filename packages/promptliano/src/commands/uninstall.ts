import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { rm, readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { BackupManager } from '../lib/backup-manager.js';
import { ServerManager } from '../lib/server-manager.js';
import { SystemChecker } from '../lib/system-checker.js';
import { logger } from '../lib/logger.js';
import { getClaudeConfigPath } from '../lib/editor-configs.js';

export interface UninstallOptions {
  force?: boolean;
  keepBackups?: boolean;
  keepData?: boolean;
  keepConfigs?: boolean;
  path?: string;
}

export function uninstallCommand(program: Command) {
  program
    .command('uninstall')
    .description('Uninstall Promptliano with cleanup options')
    .option('-f, --force', 'Force uninstall without confirmation')
    .option('--keep-backups', 'Keep backup files')
    .option('--keep-data', 'Keep user data')
    .option('--keep-configs', 'Keep MCP configurations')
    .option('-p, --path <path>', 'Installation path to uninstall')
    .action(async (options: UninstallOptions) => {
      try {
        await runUninstall(options);
      } catch (error) {
        logger.error('Uninstall failed:', error);
        process.exit(1);
      }
    });
}

export async function runUninstall(options: UninstallOptions = {}) {
  console.log(chalk.bold.red('\n🗑️  Promptliano Uninstall\n'));

  // Determine installation path
  const installPath = options.path || join(homedir(), '.promptliano');

  // Check if Promptliano is installed
  if (!existsSync(installPath)) {
    console.log(chalk.yellow('⚠️  Promptliano is not installed at:'), installPath);
    return;
  }

  // Get installation info
  const checker = new SystemChecker();
  const info = await checker.checkPromptliano();
  
  console.log(chalk.gray('Installation path:'), installPath);
  if (info.version) {
    console.log(chalk.gray('Version:'), info.version);
  }

  // Check what will be removed
  const itemsToRemove = [];
  itemsToRemove.push('• Promptliano application files');
  
  if (!options.keepData) {
    itemsToRemove.push('• User data and databases');
  }
  
  if (!options.keepBackups) {
    const backupManager = new BackupManager();
    const backups = await backupManager.list();
    if (backups.length > 0) {
      itemsToRemove.push(`• ${backups.length} backup file(s)`);
    }
  }
  
  if (!options.keepConfigs) {
    itemsToRemove.push('• MCP configurations from editors');
  }

  console.log(chalk.yellow('\nThe following will be removed:'));
  itemsToRemove.forEach(item => console.log(chalk.gray(item)));

  // Items that will be kept
  const itemsToKeep = [];
  if (options.keepData) itemsToKeep.push('• User data');
  if (options.keepBackups) itemsToKeep.push('• Backup files');
  if (options.keepConfigs) itemsToKeep.push('• MCP configurations');
  
  if (itemsToKeep.length > 0) {
    console.log(chalk.green('\nThe following will be kept:'));
    itemsToKeep.forEach(item => console.log(chalk.gray(item)));
  }

  // Confirm uninstall
  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to uninstall Promptliano?',
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.gray('Uninstall cancelled'));
      return;
    }

    // Double confirmation for complete removal
    if (!options.keepData && !options.keepBackups) {
      const { confirmComplete } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmComplete',
          message: chalk.red('This will permanently delete all data. Are you absolutely sure?'),
          default: false
        }
      ]);

      if (!confirmComplete) {
        console.log(chalk.gray('Uninstall cancelled'));
        return;
      }
    }
  }

  // Stop server if running
  const serverSpinner = ora('Stopping server...').start();
  try {
    const serverManager = new ServerManager();
    await serverManager.stop();
    serverSpinner.succeed('Server stopped');
  } catch (error) {
    serverSpinner.info('Server was not running');
  }

  // Create final backup before uninstall
  if (!options.keepBackups) {
    const backupSpinner = ora('Creating final backup...').start();
    try {
      const backupManager = new BackupManager();
      const backupPath = await backupManager.backup(installPath, {
        includeData: true,
        includeLogs: true,
        includeConfigs: true
      });
      backupSpinner.succeed(`Final backup saved to ${backupPath}`);
    } catch (error) {
      backupSpinner.warn('Backup failed, continuing with uninstall');
    }
  }

  // Remove MCP configurations if requested
  if (!options.keepConfigs) {
    const configSpinner = ora('Removing MCP configurations...').start();
    try {
      await removeMCPConfigs();
      configSpinner.succeed('MCP configurations removed');
    } catch (error) {
      configSpinner.warn('Some MCP configurations could not be removed');
    }
  }

  // Remove installation directory
  const removeSpinner = ora('Removing Promptliano files...').start();
  try {
    if (options.keepData) {
      // Selectively remove non-data directories
      const dirs = await readdir(installPath, { withFileTypes: true });
      for (const dir of dirs) {
        if (dir.isDirectory() && !['data', 'backups'].includes(dir.name)) {
          await rm(join(installPath, dir.name), { recursive: true, force: true });
        } else if (dir.isFile()) {
          await rm(join(installPath, dir.name), { force: true });
        }
      }
    } else {
      // Remove everything
      await rm(installPath, { recursive: true, force: true });
    }
    removeSpinner.succeed('Promptliano files removed');
  } catch (error) {
    removeSpinner.fail('Failed to remove some files');
    throw error;
  }

  // Remove backups if requested
  if (!options.keepBackups) {
    const backupSpinner = ora('Removing backup files...').start();
    try {
      const backupDir = join(homedir(), '.promptliano-backups');
      if (existsSync(backupDir)) {
        await rm(backupDir, { recursive: true, force: true });
      }
      backupSpinner.succeed('Backup files removed');
    } catch (error) {
      backupSpinner.warn('Some backup files could not be removed');
    }
  }

  console.log(chalk.green('\n✅ Promptliano has been uninstalled'));
  
  if (options.keepData || options.keepBackups || options.keepConfigs) {
    console.log(chalk.yellow('\n⚠️  Some files were kept as requested'));
    if (options.keepData) {
      console.log(chalk.gray(`Data files: ${join(installPath, 'data')}`));
    }
    if (options.keepBackups) {
      console.log(chalk.gray(`Backup files: ${join(homedir(), '.promptliano-backups')}`));
    }
  }

  console.log(chalk.gray('\nThank you for using Promptliano!'));
}

async function removeMCPConfigs(): Promise<void> {
  // This would need to be implemented to remove MCP configurations
  // from various editors. For now, it's a placeholder.
  const configs = [
    {
      name: 'claude',
      path: getClaudeConfigPath()
    },
    {
      name: 'vscode',
      path: join(homedir(), '.vscode', 'settings.json')
    },
    {
      name: 'cursor',
      path: join(homedir(), '.cursor', 'settings.json')
    },
    {
      name: 'windsurf',
      path: join(homedir(), '.windsurf', 'settings.json')
    }
  ];

  for (const config of configs) {
    if (existsSync(config.path)) {
      try {
        // Read config
        const content = await readFile(config.path, 'utf-8');
        const settings = JSON.parse(content);
        
        // Remove Promptliano entries
        const mcpKey = config.name === 'claude' ? 'mcpServers' : 'mcp.servers';
        if (settings[mcpKey]) {
          const keys = Object.keys(settings[mcpKey]);
          keys.forEach(key => {
            if (key.includes('promptliano')) {
              delete settings[mcpKey][key];
            }
          });
          
          // Write back
          await writeFile(config.path, JSON.stringify(settings, null, 2));
        }
      } catch (error) {
        logger.warn(`Failed to clean ${config.name} config:`, error);
      }
    }
  }
}


// Extend ServerManager
declare module '../lib/server-manager.js' {
  interface ServerManager {
    stop(): Promise<void>;
  }
}

// Import fixes
import { readFile, writeFile } from 'fs/promises';