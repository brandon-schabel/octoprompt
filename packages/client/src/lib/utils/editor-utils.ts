import { FileCode2, Zap, Code2, Package, Terminal } from 'lucide-react'

export interface EditorInfo {
  type: string
  name: string
  icon: React.ElementType
  color: string
  description: string
}

export const EDITOR_CONFIGS: Record<string, EditorInfo> = {
  vscode: {
    type: 'vscode',
    name: 'VS Code',
    icon: FileCode2,
    color: 'text-blue-500',
    description: 'Visual Studio Code workspace configuration'
  },
  cursor: {
    type: 'cursor',
    name: 'Cursor',
    icon: Zap,
    color: 'text-purple-500',
    description: 'Cursor IDE project configuration'
  },
  universal: {
    type: 'universal',
    name: 'Universal',
    icon: Code2,
    color: 'text-green-500',
    description: 'Universal MCP configuration (works with all editors)'
  },
  'claude-code': {
    type: 'claude-code',
    name: 'Claude Code',
    icon: Terminal,
    color: 'text-orange-500',
    description: 'Add Promptliano MCP server to Claude Code CLI'
  }
  // promptliano: {
  //   type: 'promptliano',
  //   name: 'Promptliano',
  //   icon: Package,
  //   color: 'text-orange-500',
  //   description: 'Promptliano-specific configuration'
  // }
}

export function getEditorInfoFromPath(path: string): EditorInfo {
  if (path.includes('.vscode/mcp.json')) {
    return EDITOR_CONFIGS.vscode
  } else if (path.includes('.cursor/mcp.json')) {
    return EDITOR_CONFIGS.cursor
  } else if (path.includes('claude-code')) {
    return EDITOR_CONFIGS['claude-code']
  }
  // else if (path.includes('.promptliano/mcp.json')) {
  //   return EDITOR_CONFIGS.promptliano
  // }
  // else if (path.includes('.mcp.json')) {
  // return EDITOR_CONFIGS.universal
  // }

  // Default fallback
  return EDITOR_CONFIGS.universal
}

export function getRelativeConfigPath(fullPath: string, projectPath: string): string {
  // Remove project path and leading slash
  return fullPath.replace(projectPath, '').replace(/^\//, '')
}

// export function getDefaultPromptlianoConfig(projectId: number, projectPath: string) {
//   return {
//     servers: {
//       promptliano: {
//         type: 'stdio' as const,
//         command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
//         args: process.platform === 'win32'
//           ? ['/c', 'packages/server/mcp-start.bat']
//           : ['packages/server/mcp-start.sh'],
//         env: {
//           PROMPTLIANO_PROJECT_ID: projectId.toString(),
//           PROMPTLIANO_PROJECT_PATH: projectPath,
//           PROMPTLIANO_API_URL: 'http://localhost:3147/api/mcp',
//           NODE_ENV: 'production'
//         }
//       }
//     }
//   }
// }
