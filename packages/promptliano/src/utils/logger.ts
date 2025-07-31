import chalk from 'chalk';
import ora, { type Ora } from 'ora';

export class Logger {
  private verbose: boolean;
  
  constructor(verbose = false) {
    this.verbose = verbose;
  }
  
  info(message: string) {
    console.log(chalk.blue('ℹ'), message);
  }
  
  success(message: string) {
    console.log(chalk.green('✓'), message);
  }
  
  error(message: string) {
    console.error(chalk.red('✗'), message);
  }
  
  warn(message: string) {
    console.warn(chalk.yellow('⚠'), message);
  }
  
  debug(message: string) {
    if (this.verbose) {
      console.log(chalk.gray('○'), message);
    }
  }
  
  spinner(text: string): Ora {
    return ora(text).start();
  }
  
  heading(text: string) {
    console.log('\n' + chalk.bold.underline(text) + '\n');
  }
  
  list(items: string[]) {
    items.forEach(item => {
      console.log(chalk.dim('  •'), item);
    });
  }
}