import { existsSync } from 'fs';
import { readFile, writeFile, mkdir, chmod, copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { platform, homedir } from 'os';
import { createHash } from 'crypto';
import { logger } from './logger.js';
import { editorConfigs } from './editor-configs.js';

interface ConfigureOptions {
  editor: string;
  projectPath: string;
  promptlianoPath: string;
}

interface ConfigResult {
  success: boolean;
  error?: string;
  editorName?: string;
  configPath?: string;
}

export class MCPConfigurator {

  async configure(options: ConfigureOptions): Promise<ConfigResult> {
    try {
      const editorConfig = editorConfigs[options.editor];
      if (!editorConfig) {
        return { success: false, error: 'Unsupported editor' };
      }

      // Get the MCP script path
      const scriptName = platform() === 'win32' ? 'mcp-start.bat' : 'mcp-start.sh';
      const scriptPath = join(options.promptlianoPath, 'packages', 'server', scriptName);

      // Ensure script exists and is executable (Unix only)
      if (!existsSync(scriptPath)) {
        return { success: false, error: 'MCP script not found. Is Promptliano installed?' };
      }

      if (platform() !== 'win32') {
        await chmod(scriptPath, 0o755);
      }

      // Generate project ID from path
      const projectId = this.generateProjectId(options.projectPath);

      // Create server configuration
      const serverName = `promptliano-${this.sanitizeProjectName(options.projectPath)}`;
      const serverConfig = {
        command: scriptPath,
        env: {
          PROMPTLIANO_PROJECT_ID: projectId.toString(),
          PROMPTLIANO_PROJECT_PATH: options.projectPath
        }
      };

      // Read existing config or create new
      let config: any = {};
      if (existsSync(editorConfig.configPath)) {
        try {
          const content = await readFile(editorConfig.configPath, 'utf-8');
          config = JSON.parse(content);
        } catch (error) {
          logger.warn('Failed to parse existing config, creating new one');
        }
      }

      // Ensure parent directory exists
      const configDir = dirname(editorConfig.configPath);
      await mkdir(configDir, { recursive: true });

      // Backup existing config before modification
      if (existsSync(editorConfig.configPath)) {
        await this.backupEditorConfig(options.editor, editorConfig.configPath);
      }

      // Update configuration
      if (!config[editorConfig.configKey]) {
        config[editorConfig.configKey] = {};
      }
      config[editorConfig.configKey][serverName] = serverConfig;

      // Special handling for Claude Code
      if (options.editor === 'claude-code') {
        if (!config.defaultMcpServers) {
          config.defaultMcpServers = [];
        }
        if (!config.defaultMcpServers.includes(serverName)) {
          config.defaultMcpServers.push(serverName);
        }
      }

      // Write configuration
      await writeFile(
        editorConfig.configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );

      return {
        success: true,
        editorName: editorConfig.name,
        configPath: editorConfig.configPath
      };
    } catch (error) {
      logger.error('MCP configuration failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async removeConfiguration(editor: string, projectPath: string): Promise<void> {
    const editorConfig = editorConfigs[editor];
    if (!editorConfig || !existsSync(editorConfig.configPath)) {
      return;
    }

    try {
      const content = await readFile(editorConfig.configPath, 'utf-8');
      const config = JSON.parse(content);
      
      const serverName = `promptliano-${this.sanitizeProjectName(projectPath)}`;
      
      if (config[editorConfig.configKey]) {
        delete config[editorConfig.configKey][serverName];
      }

      // Remove from defaultMcpServers if Claude Code
      if (editor === 'claude-code' && config.defaultMcpServers) {
        config.defaultMcpServers = config.defaultMcpServers.filter(
          (s: string) => s !== serverName
        );
      }

      await writeFile(
        editorConfig.configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Failed to remove configuration:', error);
    }
  }

  private generateProjectId(projectPath: string): number {
    // Use crypto module for consistent and secure project ID generation
    const hash = createHash('sha256');
    hash.update(projectPath);
    const hexHash = hash.digest('hex');
    // Convert first 8 chars of hex to a positive 32-bit integer
    const numericHash = parseInt(hexHash.substring(0, 8), 16);
    return Math.abs(numericHash);
  }

  private sanitizeProjectName(projectPath: string): string {
    // Get last directory name and sanitize for use in config
    if (!projectPath || projectPath.trim() === '') {
      return 'default-project';
    }
    
    const parts = projectPath.split(/[\\/]/).filter(p => p.trim() !== '');
    const name = parts[parts.length - 1] || 'project';
    const sanitized = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Ensure the result is not empty after sanitization
    return sanitized.length > 0 ? sanitized : 'project';
  }

  private async backupEditorConfig(editor: string, configPath: string): Promise<void> {
    try {
      const backupDir = join(homedir(), '.promptliano', 'backups', 'editor-configs', editor);
      await mkdir(backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-${timestamp}.json`;
      const backupPath = join(backupDir, backupName);
      
      await copyFile(configPath, backupPath);
      logger.debug(`Backed up ${editor} config to ${backupPath}`);
    } catch (error) {
      logger.warn(`Failed to backup ${editor} config:`, error);
      // Continue with configuration even if backup fails
    }
  }
}