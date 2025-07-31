import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { join } from 'path';
import { homedir } from 'os';
import { ServerManager } from '../lib/server-manager.js';
import { SystemChecker } from '../lib/system-checker.js';
import { logger } from '../lib/logger.js';

export function serverCommand(program: Command) {
  const server = program
    .command('server')
    .description('Manage Promptliano server')
    .action(async () => {
      // Default action shows status
      await checkStatus();
    });

  // Start subcommand
  server
    .command('start')
    .description('Start the Promptliano server')
    .option('-p, --port <port>', 'Port to run on', '3579')
    .option('-d, --detached', 'Run in background (default: true)', true)
    .option('-f, --foreground', 'Run in foreground')
    .action(async (options) => {
      await startServer(options);
    });

  // Stop subcommand
  server
    .command('stop')
    .description('Stop the Promptliano server')
    .action(async () => {
      await stopServer();
    });

  // Restart subcommand
  server
    .command('restart')
    .description('Restart the Promptliano server')
    .option('-p, --port <port>', 'Port to run on', '3579')
    .action(async (options) => {
      await restartServer(options);
    });

  // Status subcommand
  server
    .command('status')
    .description('Check server status')
    .action(async () => {
      await checkStatus();
    });
}

async function startServer(options: any) {
  console.log(chalk.bold.cyan('\n🚀 Starting Promptliano Server\n'));

  const serverManager = new ServerManager();
  const systemChecker = new SystemChecker();

  // Check if Promptliano is installed
  const promptlianoInfo = await systemChecker.checkPromptliano();
  if (!promptlianoInfo.installed) {
    console.log(chalk.red('❌ Promptliano is not installed.'));
    console.log(chalk.yellow('Run'), chalk.bold('npx promptliano@latest'), chalk.yellow('to install it first.'));
    process.exit(1);
  }

  // Check if server is already running
  const status = await serverManager.status();
  if (status.running) {
    console.log(chalk.yellow('⚠️  Server is already running!'));
    console.log(chalk.gray(`   PID: ${status.pid}`));
    console.log(chalk.gray(`   Port: ${status.port}`));

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Restart server', value: 'restart' },
          { name: 'Keep current server running', value: 'keep' },
          { name: 'Stop current server', value: 'stop' }
        ]
      }
    ]);

    if (action === 'keep') {
      console.log(chalk.green('✓ Server continues running'));
      return;
    } else if (action === 'stop') {
      await stopServer();
      return;
    } else if (action === 'restart') {
      await restartServer(options);
      return;
    }
  }

  // Start the server
  const spinner = ora('Starting server...').start();

  try {
    const result = await serverManager.start({
      installPath: promptlianoInfo.path!,
      port: parseInt(options.port),
      detached: options.foreground ? false : options.detached
    });

    if (result.success) {
      spinner.succeed('Server started successfully');
      console.log(chalk.green.bold('\n✅ Promptliano server is running!\n'));
      console.log(chalk.gray('Server details:'));
      console.log(chalk.gray(`  📍 Port: ${result.port}`));
      console.log(chalk.gray(`  🔢 PID: ${result.pid}`));
      console.log(chalk.gray(`  📁 Logs: ${result.logPath}`));
      if (result.errorLogPath) {
        console.log(chalk.gray(`  ⚠️  Error logs: ${result.errorLogPath}`));
      }
      console.log('\n' + chalk.cyan('Access Promptliano at:'), chalk.bold(`http://localhost:${result.port}`));
      console.log(chalk.gray('\nThe server runs in the background. To stop it:'));
      console.log(chalk.cyan(`  promptliano server stop`));
    } else {
      spinner.fail('Failed to start server');
      console.log();
      console.log(chalk.red('Error:'));
      console.log(result.error);

      if (result.errorLogPath) {
        console.log();
        console.log(chalk.gray('Check error log for details:'));
        console.log(chalk.gray(result.errorLogPath));
      }

      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Server start failed');
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function stopServer() {
  console.log(chalk.bold.cyan('\n🛑 Stopping Promptliano Server\n'));

  const serverManager = new ServerManager();
  const spinner = ora('Stopping server...').start();

  try {
    const stopped = await serverManager.stop();

    if (stopped) {
      spinner.succeed('Server stopped successfully');
      console.log(chalk.green('✅ Promptliano server has been stopped'));
    } else {
      spinner.warn('Server was not running');
      console.log(chalk.yellow('ℹ️  No running server found'));
    }
  } catch (error) {
    spinner.fail('Failed to stop server');
    logger.error('Failed to stop server:', error);
    process.exit(1);
  }
}

async function restartServer(options: any) {
  console.log(chalk.bold.cyan('\n🔄 Restarting Promptliano Server\n'));

  const serverManager = new ServerManager();
  const systemChecker = new SystemChecker();

  // Check if Promptliano is installed
  const promptlianoInfo = await systemChecker.checkPromptliano();
  if (!promptlianoInfo.installed) {
    console.log(chalk.red('❌ Promptliano is not installed.'));
    console.log(chalk.yellow('Run'), chalk.bold('npx promptliano@latest'), chalk.yellow('to install it first.'));
    process.exit(1);
  }

  const spinner = ora('Restarting server...').start();

  try {
    const result = await serverManager.restart({
      installPath: promptlianoInfo.path!,
      port: parseInt(options.port),
      detached: true
    });

    if (result.success) {
      spinner.succeed('Server restarted successfully');
      console.log(chalk.green.bold('\n✅ Promptliano server restarted!\n'));
      console.log(chalk.gray('Server details:'));
      console.log(chalk.gray(`  📍 Port: ${result.port}`));
      console.log(chalk.gray(`  🔢 PID: ${result.pid}`));
      console.log('\n' + chalk.cyan('Access Promptliano at:'), chalk.bold(`http://localhost:${result.port}`));
      console.log(chalk.gray('\nTo stop the server:'));
      console.log(chalk.cyan(`  promptliano server stop`));
    } else {
      spinner.fail('Failed to restart server');
      console.log(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Server restart failed');
    logger.error('Failed to restart server:', error);
    process.exit(1);
  }
}

async function checkStatus() {
  console.log(chalk.bold.cyan('\n📊 Promptliano Server Status\n'));

  const serverManager = new ServerManager();
  const systemChecker = new SystemChecker();

  // Check installation
  const promptlianoInfo = await systemChecker.checkPromptliano();

  if (!promptlianoInfo.installed) {
    console.log(chalk.red('❌ Promptliano is not installed'));
    console.log(chalk.yellow('\nRun'), chalk.bold('npx promptliano@latest'), chalk.yellow('to install it.'));
    return;
  }

  console.log(chalk.green('✅ Promptliano is installed'));
  console.log(chalk.gray(`   Path: ${promptlianoInfo.path}`));
  if (promptlianoInfo.version) {
    console.log(chalk.gray(`   Version: v${promptlianoInfo.version}`));
  }
  console.log();

  // Check server status
  const status = await serverManager.status();

  if (status.running) {
    console.log(chalk.green('✅ Server is running'));
    console.log(chalk.gray(`   PID: ${status.pid}`));
    console.log(chalk.gray(`   Port: ${status.port}`));
    console.log('\n' + chalk.cyan('Access at:'), chalk.bold(`http://localhost:${status.port}`));
    console.log(chalk.gray('\nUse'), chalk.bold('promptliano server stop'), chalk.gray('to stop the server'));
  } else {
    console.log(chalk.yellow('⚠️  Server is not running'));
    console.log(chalk.gray('\nUse'), chalk.bold('promptliano server start'), chalk.gray('to start the server'));
  }
}