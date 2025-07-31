import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { chmod, access, constants } from 'fs/promises';
import { join } from 'path';
import { homedir, platform } from 'os';
import { PermissionChecker } from '../lib/permission-checker.js';
import { SystemChecker } from '../lib/system-checker.js';
import { MCPConfigurator } from '../lib/mcp-configurator.js';
import { BackupManager } from '../lib/backup-manager.js';
import { logger } from '../lib/logger.js';
import { safeExec } from '../lib/safe-exec.js';
import { getClaudeConfigPath } from '../lib/editor-configs.js';


export interface RepairOptions {
  path?: string;
  fixPermissions?: boolean;
  fixMcp?: boolean;
  fixDependencies?: boolean;
  backup?: boolean;
  force?: boolean;
}

export function repairCommand(program: Command) {
  program
    .command('repair')
    .description('Repair and fix common Promptliano installation issues')
    .option('-p, --path <path>', 'Installation path to repair')
    .option('--fix-permissions', 'Fix file and directory permissions')
    .option('--fix-mcp', 'Repair MCP configurations')
    .option('--fix-dependencies', 'Reinstall dependencies')
    .option('--no-backup', 'Skip backup before repair')
    .option('-f, --force', 'Force repair without prompts')
    .action(async (options: RepairOptions) => {
      try {
        await runRepair(options);
      } catch (error) {
        logger.error('Repair failed:', error);
        process.exit(1);
      }
    });
}

export async function runRepair(options: RepairOptions = {}) {
  console.log(chalk.bold.blue('\n🔧 Promptliano Repair Tool\n'));

  // Determine installation path
  const installPath = options.path || join(homedir(), '.promptliano');

  // Check if Promptliano is installed
  if (!existsSync(installPath)) {
    console.log(chalk.red('❌ Promptliano is not installed at:'), installPath);
    console.log(chalk.gray('Use "promptliano install" to install Promptliano first'));
    return;
  }

  // Run diagnostics
  console.log(chalk.bold('Running diagnostics...\n'));
  const issues = await runDiagnostics(installPath);

  if (issues.length === 0) {
    console.log(chalk.green('✅ No issues found! Promptliano installation appears healthy.'));
    return;
  }

  // Display issues
  console.log(chalk.yellow(`Found ${issues.length} issue(s):\n`));
  issues.forEach((issue, index) => {
    console.log(chalk.red(`${index + 1}. ${issue.description}`));
    if (issue.suggestion) {
      console.log(chalk.gray(`   Suggestion: ${issue.suggestion}`));
    }
  });

  // Confirm repair
  if (!options.force) {
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Would you like to attempt repairs?',
        default: true
      }
    ]);

    if (!proceed) {
      console.log(chalk.gray('Repair cancelled'));
      return;
    }
  }

  // Create backup if requested
  if (options.backup !== false) {
    const backupSpinner = ora('Creating backup...').start();
    try {
      const backupManager = new BackupManager();
      const backupPath = await backupManager.backup(installPath, {
        includeData: true,
        includeLogs: true,
        includeConfigs: true
      });
      backupSpinner.succeed(`Backup created: ${backupPath}`);
    } catch (error) {
      backupSpinner.fail('Backup failed');
      
      if (!options.force) {
        const { continueWithoutBackup } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueWithoutBackup',
            message: 'Continue repair without backup?',
            default: false
          }
        ]);

        if (!continueWithoutBackup) {
          console.log(chalk.gray('Repair cancelled'));
          return;
        }
      }
    }
  }

  // Perform repairs
  console.log(chalk.bold('\nPerforming repairs...\n'));
  const results = await performRepairs(installPath, issues, options);

  // Report results
  console.log(chalk.bold('\nRepair Results:\n'));
  let successCount = 0;
  let failureCount = 0;

  results.forEach(result => {
    if (result.success) {
      console.log(chalk.green(`✅ ${result.issue}: ${result.message}`));
      successCount++;
    } else {
      console.log(chalk.red(`❌ ${result.issue}: ${result.error}`));
      failureCount++;
    }
  });

  console.log(chalk.bold(`\nSummary: ${successCount} fixed, ${failureCount} failed`));

  if (failureCount > 0) {
    console.log(chalk.yellow('\n⚠️  Some repairs failed. You may need to reinstall Promptliano.'));
  } else {
    console.log(chalk.green('\n✅ All repairs completed successfully!'));
  }
}

interface Issue {
  type: string;
  description: string;
  suggestion?: string;
  path?: string;
}

async function runDiagnostics(installPath: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const permissionChecker = new PermissionChecker();
  const systemChecker = new SystemChecker();

  // Check core directories
  const requiredDirs = [
    'packages/server',
    'packages/client',
    'packages/shared',
    'packages/schemas'
  ];

  for (const dir of requiredDirs) {
    const dirPath = join(installPath, dir);
    if (!existsSync(dirPath)) {
      issues.push({
        type: 'missing-directory',
        description: `Missing required directory: ${dir}`,
        suggestion: 'Reinstall Promptliano or restore from backup',
        path: dirPath
      });
    }
  }

  // Check permissions
  const perms = await permissionChecker.check(installPath);
  if (!perms.canRead || !perms.canWrite) {
    issues.push({
      type: 'permissions',
      description: 'Insufficient permissions on installation directory',
      suggestion: `Run: chmod -R 755 ${installPath}`,
      path: installPath
    });
  }

  // Check executables
  const executables = [
    'node_modules/.bin/bun',
    'packages/server/start-server.ts'
  ];

  for (const exec of executables) {
    const execPath = join(installPath, exec);
    if (existsSync(execPath)) {
      const isExecutable = await permissionChecker.checkExecutable(execPath);
      if (!isExecutable) {
        issues.push({
          type: 'executable-permissions',
          description: `File not executable: ${exec}`,
          suggestion: `Run: chmod +x ${execPath}`,
          path: execPath
        });
      }
    }
  }

  // Check dependencies
  const packageJsonPath = join(installPath, 'package.json');
  const nodeModulesPath = join(installPath, 'node_modules');
  
  if (existsSync(packageJsonPath) && !existsSync(nodeModulesPath)) {
    issues.push({
      type: 'missing-dependencies',
      description: 'Node modules not installed',
      suggestion: 'Run: bun install',
      path: nodeModulesPath
    });
  }

  // Check MCP configurations
  const mcpIssues = await checkMCPConfigurations();
  issues.push(...mcpIssues);

  // Check server health
  try {
    const response = await fetch(`http://localhost:3579/api/health`, {
      signal: AbortSignal.timeout(2000)
    });
    if (!response.ok) {
      issues.push({
        type: 'server-unhealthy',
        description: 'Server is running but not responding correctly',
        suggestion: 'Restart the server'
      });
    }
  } catch {
    // Server not running - not necessarily an issue
  }

  return issues;
}

async function checkMCPConfigurations(): Promise<Issue[]> {
  const issues: Issue[] = [];
  const configurator = new MCPConfigurator();
  
  const configs = [
    { name: 'claude', path: getClaudeConfigPath() },
    { name: 'vscode', path: join(homedir(), '.vscode', 'settings.json') },
    { name: 'cursor', path: join(homedir(), '.cursor', 'settings.json') },
    { name: 'windsurf', path: join(homedir(), '.windsurf', 'settings.json') }
  ];

  for (const config of configs) {
    if (existsSync(config.path)) {
      try {
        await access(config.path, constants.R_OK | constants.W_OK);
      } catch {
        issues.push({
          type: 'mcp-permissions',
          description: `Cannot access ${config.name} configuration`,
          suggestion: `Check permissions on ${config.path}`,
          path: config.path
        });
      }
    }
  }

  return issues;
}

interface RepairResult {
  issue: string;
  success: boolean;
  message?: string;
  error?: string;
}

async function performRepairs(
  installPath: string,
  issues: Issue[],
  options: RepairOptions
): Promise<RepairResult[]> {
  const results: RepairResult[] = [];
  const permissionChecker = new PermissionChecker();

  for (const issue of issues) {
    const spinner = ora(`Fixing: ${issue.description}`).start();
    
    try {
      switch (issue.type) {
        case 'permissions':
          if (options.fixPermissions !== false) {
            await fixDirectoryPermissions(installPath);
            spinner.succeed('Fixed directory permissions');
            results.push({
              issue: issue.description,
              success: true,
              message: 'Permissions fixed'
            });
          } else {
            spinner.info('Skipped (--fix-permissions not set)');
          }
          break;

        case 'executable-permissions':
          if (options.fixPermissions !== false && issue.path) {
            await permissionChecker.makeExecutable(issue.path);
            spinner.succeed('Fixed executable permissions');
            results.push({
              issue: issue.description,
              success: true,
              message: 'Made file executable'
            });
          } else {
            spinner.info('Skipped');
          }
          break;

        case 'missing-dependencies':
          if (options.fixDependencies !== false) {
            await safeExec('bun install', { cwd: installPath });
            spinner.succeed('Dependencies installed');
            results.push({
              issue: issue.description,
              success: true,
              message: 'Dependencies installed'
            });
          } else {
            spinner.info('Skipped (--fix-dependencies not set)');
          }
          break;

        case 'mcp-permissions':
          if (options.fixMcp !== false && issue.path) {
            await fixFilePermissions(issue.path);
            spinner.succeed('Fixed MCP config permissions');
            results.push({
              issue: issue.description,
              success: true,
              message: 'Permissions fixed'
            });
          } else {
            spinner.info('Skipped');
          }
          break;

        case 'missing-directory':
          spinner.fail('Cannot fix missing directories');
          results.push({
            issue: issue.description,
            success: false,
            error: 'Reinstallation required'
          });
          break;

        default:
          spinner.warn('No automatic fix available');
          results.push({
            issue: issue.description,
            success: false,
            error: 'Manual intervention required'
          });
      }
    } catch (error) {
      spinner.fail('Fix failed');
      results.push({
        issue: issue.description,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}

async function fixDirectoryPermissions(dirPath: string): Promise<void> {
  if (platform() === 'win32') {
    // Windows permissions are handled differently
    return;
  }

  await chmod(dirPath, 0o755);
  
  // Recursively fix subdirectories
  const { readdir, stat } = await import('fs/promises');
  const entries = await readdir(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      await chmod(fullPath, 0o755);
      await fixDirectoryPermissions(fullPath);
    } else {
      await chmod(fullPath, 0o644);
    }
  }
}

async function fixFilePermissions(filePath: string): Promise<void> {
  if (platform() === 'win32') {
    return;
  }
  
  await chmod(filePath, 0o644);
}

