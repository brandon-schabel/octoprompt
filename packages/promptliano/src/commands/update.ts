import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { PromptlianoUpdater } from '../lib/updater.js';
import { logger } from '../lib/logger.js';
import inquirer from 'inquirer';

export function updateCommand(program: Command) {
  program
    .command('update')
    .description('Update Promptliano to the latest version')
    .option('--check', 'Check for updates without installing')
    .option('--force', 'Force update even if on latest version')
    .action(async (options) => {
      try {
        await updatePromptliano(options);
      } catch (error) {
        logger.error('Update failed:', error);
        process.exit(1);
      }
    });
}

export async function updatePromptliano(options: any = {}) {
  console.log(chalk.bold.cyan('\n🔄 Promptliano Update\n'));
  
  const updater = new PromptlianoUpdater();
  
  // Check for updates
  const spinner = ora('Checking for updates...').start();
  const updateInfo = await updater.checkForUpdates();
  spinner.stop();
  
  if (!updateInfo.hasUpdate && !options.force) {
    console.log(chalk.green('✅ You are running the latest version!'));
    console.log(chalk.gray(`Current version: ${updateInfo.currentVersion}`));
    return;
  }
  
  if (options.check) {
    if (updateInfo.hasUpdate) {
      console.log(chalk.yellow('🆕 Update available!'));
      console.log(chalk.gray(`Current version: ${updateInfo.currentVersion}`));
      console.log(chalk.green(`Latest version: ${updateInfo.latestVersion}`));
      console.log('\nRun', chalk.bold('promptliano update'), 'to install');
    }
    return;
  }
  
  // Show update info
  console.log(chalk.yellow('🆕 Update available!'));
  console.log(chalk.gray(`Current version: ${updateInfo.currentVersion || 'unknown'}`));
  console.log(chalk.green(`Latest version: ${updateInfo.latestVersion}`));
  
  if (updateInfo.releaseNotes) {
    console.log(chalk.bold('\nRelease Notes:'));
    console.log(updateInfo.releaseNotes);
  }
  
  // Confirm update
  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Proceed with update?',
      default: true
    }
  ]);
  
  if (!proceed) {
    console.log(chalk.gray('Update cancelled'));
    return;
  }
  
  // Perform update
  const updateSpinner = ora('Downloading update...').start();
  
  try {
    await updater.update({
      onProgress: (progress) => {
        updateSpinner.text = `Downloading update... ${progress}%`;
      }
    });
    
    updateSpinner.succeed('Update downloaded');
    
    // Install update
    const installSpinner = ora('Installing update...').start();
    await updater.install();
    installSpinner.succeed('Update installed');
    
    console.log(chalk.green('\n✅ Promptliano updated successfully!'));
    console.log(chalk.cyan('Please restart any running Promptliano servers.'));
    
  } catch (error) {
    updateSpinner.fail('Update failed');
    throw error;
  }
}