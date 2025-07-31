import chalk from 'chalk';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SystemChecker } from './system-checker.js';
import packageJson from '../../package.json' assert { type: 'json' };

/**
 * Display version information for Promptliano CLI
 * @param showDetailed - Whether to show installation details
 */
export async function displayVersionInfo(showDetailed = true) {
  // Display CLI version
  console.log(chalk.cyan(`\n🎭 Promptliano CLI v${packageJson.version}\n`));

  if (showDetailed) {
    try {
      const checker = new SystemChecker();
      const promptlianoInfo = await checker.checkPromptliano();
      
      if (promptlianoInfo.installed && promptlianoInfo.path) {
        console.log(chalk.gray('Installation Details:'));
        console.log(chalk.gray(`  📁 Path: ${promptlianoInfo.path}`));
        if (promptlianoInfo.version) {
          console.log(chalk.gray(`  📦 App Version: v${promptlianoInfo.version}`));
        } else {
          console.log(chalk.gray(`  📦 App Version: installed (version unknown)`));
        }
        console.log('');
      } else {
        // Check if partial installation exists
        const installDir = join(homedir(), '.promptliano');
        if (existsSync(installDir) && !promptlianoInfo.installed) {
          console.log(chalk.yellow('⚠️  Incomplete Promptliano installation detected.'));
          console.log(chalk.gray(`   Path: ${installDir}`));
          console.log(chalk.gray('   Run this command to complete setup!\n'));
        } else {
          console.log(chalk.gray('ℹ️  Promptliano is not installed yet.'));
          console.log(chalk.gray('   Run this command to set it up!\n'));
        }
      }
    } catch (error) {
      // Silently handle errors in version checking
      console.log(chalk.gray('ℹ️  Run this command to install Promptliano.\n'));
    }
  }
}

/**
 * Display a compact version string
 */
export function getVersionString(): string {
  return `Promptliano CLI v${packageJson.version}`;
}