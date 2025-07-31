import { execSync } from 'node:child_process';
import { Logger } from '../utils/logger.js';
import { BUN_INSTALL_SCRIPT } from '../utils/constants.js';

export class BunService {
  private logger: Logger;
  
  constructor(logger: Logger) {
    this.logger = logger;
  }
  
  isInstalled(): boolean {
    try {
      execSync('bun --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  
  getVersion(): string | null {
    try {
      const version = execSync('bun --version', { encoding: 'utf-8' }).trim();
      return version;
    } catch {
      return null;
    }
  }
  
  async install(): Promise<boolean> {
    this.logger.info('Bun is not installed. Installing Bun...');
    const spinner = this.logger.spinner('Downloading and installing Bun');
    
    try {
      // Download and run the install script
      execSync(`curl -fsSL ${BUN_INSTALL_SCRIPT} | bash`, {
        stdio: 'inherit',
        shell: '/bin/bash'
      });
      
      // Add Bun to PATH for current session
      const bunPath = `${process.env.HOME}/.bun/bin`;
      process.env.PATH = `${bunPath}:${process.env.PATH}`;
      
      spinner.succeed('Bun installed successfully');
      
      // Verify installation
      if (this.isInstalled()) {
        const version = this.getVersion();
        this.logger.success(`Bun ${version} is now installed`);
        return true;
      } else {
        throw new Error('Bun installation verification failed');
      }
    } catch (error) {
      spinner.fail('Failed to install Bun');
      this.logger.error(`Installation error: ${error}`);
      this.logger.info('Please install Bun manually from https://bun.sh');
      return false;
    }
  }
  
  async ensureInstalled(): Promise<boolean> {
    if (this.isInstalled()) {
      const version = this.getVersion();
      this.logger.debug(`Bun ${version} is already installed`);
      return true;
    }
    
    return this.install();
  }
}