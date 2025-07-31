import { describe, test, expect } from 'bun:test';
import { join } from 'path';
import { homedir, platform } from 'os';
import { editorConfigs, getClaudeConfigPath } from '../lib/editor-configs.js';

describe('Editor Configs', () => {
  test('should export all supported editor configs', () => {
    expect(editorConfigs).toHaveProperty('claude');
    expect(editorConfigs).toHaveProperty('vscode');
    expect(editorConfigs).toHaveProperty('cursor');
    expect(editorConfigs).toHaveProperty('windsurf');
    expect(editorConfigs).toHaveProperty('continue');
    expect(editorConfigs).toHaveProperty('claude-code');
  });

  test('should have correct config structure for each editor', () => {
    for (const [key, config] of Object.entries(editorConfigs)) {
      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('configPath');
      expect(config).toHaveProperty('configKey');
      expect(typeof config.name).toBe('string');
      expect(typeof config.configPath).toBe('string');
      expect(typeof config.configKey).toBe('string');
    }
  });

  test('should return correct Claude config path for current platform', () => {
    const path = getClaudeConfigPath();
    
    if (platform() === 'darwin') {
      expect(path).toBe(join(homedir(), 'Library', 'Application Support', 'Claude', 'mcp-settings.json'));
    } else if (platform() === 'win32') {
      expect(path).toBe(join(homedir(), 'AppData', 'Roaming', 'Claude', 'mcp-settings.json'));
    } else {
      expect(path).toBe(join(homedir(), '.config', 'claude', 'mcp-settings.json'));
    }
  });

  test('should use consistent MCP key names', () => {
    // Claude and Claude Code use 'mcpServers'
    expect(editorConfigs.claude.configKey).toBe('mcpServers');
    expect(editorConfigs['claude-code'].configKey).toBe('mcpServers');
    
    // VS Code family uses 'mcp.servers'
    expect(editorConfigs.vscode.configKey).toBe('mcp.servers');
    expect(editorConfigs.cursor.configKey).toBe('mcp.servers');
    expect(editorConfigs.windsurf.configKey).toBe('mcp.servers');
    expect(editorConfigs.continue.configKey).toBe('mcp.servers');
  });
});