import { existsSync } from 'fs';
import { mkdir, readdir, cp, writeFile, readFile, rm, stat } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { create as createTar } from 'tar';
import { logger } from './logger.js';
import { getClaudeConfigPath } from './editor-configs.js';

export interface BackupOptions {
  includeData?: boolean;
  includeLogs?: boolean;
  includeConfigs?: boolean;
  compress?: boolean;
}

export interface BackupMetadata {
  version: string;
  timestamp: string;
  source: string;
  options: BackupOptions;
  promptlianoVersion?: string;
  nodeVersion?: string;
  platform?: string;
}

export interface RestoreOptions {
  overwrite?: boolean;
  skipData?: boolean;
  skipConfigs?: boolean;
}

export class BackupManager {
  private backupDir: string;

  constructor() {
    this.backupDir = join(homedir(), '.promptliano-backups');
  }

  async backup(sourcePath: string, options: BackupOptions = {}): Promise<string> {
    const {
      includeData = true,
      includeLogs = false,
      includeConfigs = true,
      compress = true
    } = options;

    // Ensure backup directory exists
    await mkdir(this.backupDir, { recursive: true });

    // Create timestamp-based backup name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `promptliano-backup-${timestamp}`;
    const backupPath = join(this.backupDir, backupName);

    try {
      // Create backup directory
      await mkdir(backupPath, { recursive: true });

      // Save backup metadata
      const metadata: BackupMetadata = {
        version: await this.getVersion(sourcePath),
        timestamp,
        source: sourcePath,
        options,
        promptlianoVersion: await this.getPromptlianoVersion(sourcePath),
        nodeVersion: process.version,
        platform: platform()
      };
      await writeFile(
        join(backupPath, 'backup-metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      // Define what to backup
      const itemsToBackup = [
        { path: 'package.json', required: true },
        { path: 'packages', required: true }
      ];

      if (includeData) {
        itemsToBackup.push(
          { path: 'data', required: false },
          { path: '.env', required: false },
          { path: '.env.local', required: false }
        );
      }

      if (includeLogs) {
        itemsToBackup.push({ path: 'logs', required: false });
      }

      if (includeConfigs) {
        // Backup MCP configurations from various editors
        await this.backupMCPConfigs(backupPath);
      }

      // Copy items
      for (const item of itemsToBackup) {
        const itemPath = join(sourcePath, item.path);
        if (existsSync(itemPath)) {
          const destPath = join(backupPath, 'files', item.path);
          await mkdir(join(destPath, '..'), { recursive: true });
          await cp(itemPath, destPath, { recursive: true });
        } else if (item.required) {
          throw new Error(`Required item not found: ${item.path}`);
        }
      }

      // Compress if requested
      if (compress) {
        const tarPath = `${backupPath}.tar.gz`;
        await this.compressBackup(backupPath, tarPath);
        
        // Remove uncompressed backup
        await rm(backupPath, { recursive: true, force: true });
        
        return tarPath;
      }

      return backupPath;
    } catch (error) {
      logger.error('Backup failed:', error);
      throw new Error(`Backup failed: ${error.message}`);
    }
  }

  async restore(backupPath: string, targetPath: string, options: RestoreOptions = {}): Promise<void> {
    const {
      overwrite = false,
      skipData = false,
      skipConfigs = false
    } = options;

    try {
      // Check if backup exists
      if (!existsSync(backupPath)) {
        throw new Error('Backup not found');
      }

      // Check if target exists
      if (existsSync(targetPath) && !overwrite) {
        throw new Error('Target path exists. Use overwrite option to continue.');
      }

      // Extract if compressed
      let extractedPath = backupPath;
      if (backupPath.endsWith('.tar.gz')) {
        extractedPath = backupPath.replace('.tar.gz', '');
        await this.extractBackup(backupPath, extractedPath);
      }

      // Read metadata
      const metadataPath = join(extractedPath, 'backup-metadata.json');
      if (!existsSync(metadataPath)) {
        throw new Error('Invalid backup: metadata not found');
      }

      const metadata: BackupMetadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
      logger.info(`Restoring backup from ${metadata.timestamp}`);
      
      // Check version compatibility
      const compatibilityCheck = await this.checkVersionCompatibility(metadata, targetPath);
      if (!compatibilityCheck.compatible) {
        logger.warn(`Version compatibility warning: ${compatibilityCheck.warning}`);
        // Continue with restore but warn user
      }

      // Restore files
      const filesPath = join(extractedPath, 'files');
      if (existsSync(filesPath)) {
        await cp(filesPath, targetPath, { 
          recursive: true,
          filter: (src) => {
            if (skipData && src.includes('/data')) return false;
            return true;
          }
        });
      }

      // Restore MCP configs if requested
      if (!skipConfigs && existsSync(join(extractedPath, 'mcp-configs'))) {
        await this.restoreMCPConfigs(join(extractedPath, 'mcp-configs'));
      }

      // Clean up extracted files if we extracted them
      if (backupPath !== extractedPath) {
        await rm(extractedPath, { recursive: true, force: true });
      }

      logger.info('Restore completed successfully');
    } catch (error) {
      logger.error('Restore failed:', error);
      throw new Error(`Restore failed: ${error.message}`);
    }
  }

  async list(): Promise<Array<{
    name: string;
    path: string;
    timestamp: string;
    size: number;
    compressed: boolean;
  }>> {
    await mkdir(this.backupDir, { recursive: true });
    
    const entries = await readdir(this.backupDir, { withFileTypes: true });
    const backups = [];

    for (const entry of entries) {
      if (entry.name.startsWith('promptliano-backup-')) {
        const fullPath = join(this.backupDir, entry.name);
        const stats = await stat(fullPath);
        
        backups.push({
          name: entry.name,
          path: fullPath,
          timestamp: entry.name.replace('promptliano-backup-', '').replace('.tar.gz', ''),
          size: stats.size,
          compressed: entry.name.endsWith('.tar.gz')
        });
      }
    }

    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  private async getVersion(sourcePath: string): Promise<string> {
    try {
      const packagePath = join(sourcePath, 'package.json');
      if (existsSync(packagePath)) {
        const pkg = JSON.parse(await readFile(packagePath, 'utf-8'));
        return pkg.version || 'unknown';
      }
    } catch (error) {
      // Ignore
    }
    return 'unknown';
  }

  private async backupMCPConfigs(backupPath: string): Promise<void> {
    const configsPath = join(backupPath, 'mcp-configs');
    await mkdir(configsPath, { recursive: true });

    // Define MCP config locations
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
          await cp(config.path, join(configsPath, `${config.name}-settings.json`));
        } catch (error) {
          logger.warn(`Failed to backup ${config.name} config:`, error);
        }
      }
    }
  }

  private async restoreMCPConfigs(configsPath: string): Promise<void> {
    const entries = await readdir(configsPath);
    
    for (const entry of entries) {
      const [editor] = entry.split('-');
      let targetPath: string;

      switch (editor) {
        case 'claude':
          targetPath = getClaudeConfigPath();
          break;
        case 'vscode':
          targetPath = join(homedir(), '.vscode', 'settings.json');
          break;
        case 'cursor':
          targetPath = join(homedir(), '.cursor', 'settings.json');
          break;
        case 'windsurf':
          targetPath = join(homedir(), '.windsurf', 'settings.json');
          break;
        default:
          continue;
      }

      try {
        await mkdir(join(targetPath, '..'), { recursive: true });
        await cp(join(configsPath, entry), targetPath);
        logger.info(`Restored ${editor} configuration`);
      } catch (error) {
        logger.warn(`Failed to restore ${editor} config:`, error);
      }
    }
  }

  private async compressBackup(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await createTar(
        {
          gzip: true,
          file: targetPath,
          cwd: join(sourcePath, '..'),
        },
        [basename(sourcePath)]
      );
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error(
          'tar package is not installed. Please run "npm install" or "bun install" to install dependencies.'
        );
      }
      throw error;
    }
  }

  private async extractBackup(sourcePath: string, targetPath: string): Promise<void> {
    try {
      const { extract } = await import('tar');
      await extract({
        file: sourcePath,
        cwd: join(targetPath, '..'),
      });
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error(
          'tar package is not installed. Please run "npm install" or "bun install" to install dependencies.'
        );
      }
      throw error;
    }
  }

  
  private async getPromptlianoVersion(sourcePath: string): Promise<string | undefined> {
    try {
      const serverPackagePath = join(sourcePath, 'packages', 'server', 'package.json');
      if (existsSync(serverPackagePath)) {
        const content = await readFile(serverPackagePath, 'utf-8');
        const pkg = JSON.parse(content);
        return pkg.version;
      }
    } catch (error) {
      // Ignore
    }
    return undefined;
  }
  
  private async checkVersionCompatibility(
    metadata: BackupMetadata,
    targetPath: string
  ): Promise<{ compatible: boolean; warning?: string }> {
    // Check major version compatibility
    if (metadata.promptlianoVersion) {
      const currentVersion = await this.getPromptlianoVersion(targetPath);
      if (currentVersion) {
        const [backupMajor] = metadata.promptlianoVersion.split('.').map(Number);
        const [currentMajor] = currentVersion.split('.').map(Number);
        
        if (backupMajor !== currentMajor) {
          return {
            compatible: true,
            warning: `Backup is from version ${metadata.promptlianoVersion}, current version is ${currentVersion}. Major version mismatch may cause issues.`
          };
        }
      }
    }
    
    // Check platform compatibility
    if (metadata.platform && metadata.platform !== platform()) {
      return {
        compatible: true,
        warning: `Backup is from ${metadata.platform} platform, current platform is ${platform()}. Some configurations may not work correctly.`
      };
    }
    
    return { compatible: true };
  }
}

