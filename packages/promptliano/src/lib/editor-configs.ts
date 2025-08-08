import { homedir, platform } from 'os'
import { join } from 'path'

export interface EditorConfig {
  name: string
  configPath: string
  configKey: string
}

export function getClaudeConfigPath(): string {
  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Claude', 'mcp-settings.json')
  } else if (platform() === 'win32') {
    return join(homedir(), 'AppData', 'Roaming', 'Claude', 'mcp-settings.json')
  } else {
    return join(homedir(), '.config', 'claude', 'mcp-settings.json')
  }
}

export const editorConfigs: Record<string, EditorConfig> = {
  claude: {
    name: 'Claude Desktop',
    configPath: getClaudeConfigPath(),
    configKey: 'mcpServers'
  },
  vscode: {
    name: 'VS Code',
    configPath: join(homedir(), '.vscode', 'settings.json'),
    configKey: 'mcp.servers'
  },
  cursor: {
    name: 'Cursor',
    configPath: join(homedir(), '.cursor', 'settings.json'),
    configKey: 'mcp.servers'
  },
  windsurf: {
    name: 'Windsurf',
    configPath: join(homedir(), '.windsurf', 'settings.json'),
    configKey: 'mcp.servers'
  },
  continue: {
    name: 'Continue',
    configPath: join(homedir(), '.continue', 'config.json'),
    configKey: 'mcp.servers'
  },
  'claude-code': {
    name: 'Claude Code',
    configPath: join(homedir(), '.config', 'claude-code', 'mcp-settings.json'),
    configKey: 'mcpServers'
  }
}
