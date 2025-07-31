import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir, platform } from 'os';
import { logger } from './logger.js';
import { safeExec, safeReadPlist } from './safe-exec.js';

interface DetectedEditor {
  id: string;
  name: string;
  version: string;
  path?: string;
}

export async function detectEditors(): Promise<DetectedEditor[]> {
  const editors: DetectedEditor[] = [];
  
  // Detect Claude Desktop
  const claude = await detectClaude();
  if (claude) editors.push(claude);
  
  // Detect VS Code
  const vscode = await detectVSCode();
  if (vscode) editors.push(vscode);
  
  // Detect Cursor
  const cursor = await detectCursor();
  if (cursor) editors.push(cursor);
  
  // Detect Windsurf
  const windsurf = await detectWindsurf();
  if (windsurf) editors.push(windsurf);
  
  // Detect Continue
  const continueEditor = await detectContinue();
  if (continueEditor) editors.push(continueEditor);
  
  // Detect Claude Code
  const claudeCode = await detectClaudeCode();
  if (claudeCode) editors.push(claudeCode);
  
  return editors;
}

async function detectClaude(): Promise<DetectedEditor | null> {
  try {
    if (platform() === 'darwin') {
      const appPath = '/Applications/Claude.app';
      if (existsSync(appPath)) {
        // Try to get version from Info.plist
        const plistPath = join(appPath, 'Contents', 'Info.plist');
        if (existsSync(plistPath)) {
          const stdout = await safeReadPlist(plistPath, 'CFBundleShortVersionString');
          return {
            id: 'claude',
            name: 'Claude Desktop',
            version: stdout.trim(),
            path: appPath
          };
        }
        return {
          id: 'claude',
          name: 'Claude Desktop',
          version: 'unknown',
          path: appPath
        };
      }
    } else if (platform() === 'win32') {
      // Check common Windows installation paths
      const paths = [
        join(process.env.LOCALAPPDATA || '', 'Programs', 'claude'),
        join(process.env.PROGRAMFILES || '', 'Claude')
      ];
      
      for (const path of paths) {
        if (existsSync(path)) {
          return {
            id: 'claude',
            name: 'Claude Desktop',
            version: 'unknown',
            path
          };
        }
      }
    }
  } catch (error) {
    logger.debug('Failed to detect Claude:', error);
  }
  
  return null;
}

async function detectVSCode(): Promise<DetectedEditor | null> {
  try {
    const { stdout } = await safeExec('code --version');
    const [version] = stdout.trim().split('\n');
    return {
      id: 'vscode',
      name: 'VS Code',
      version
    };
  } catch (error) {
    logger.debug('VS Code not found');
  }
  
  return null;
}

async function detectCursor(): Promise<DetectedEditor | null> {
  try {
    if (platform() === 'darwin') {
      const appPath = '/Applications/Cursor.app';
      if (existsSync(appPath)) {
        return {
          id: 'cursor',
          name: 'Cursor',
          version: 'unknown',
          path: appPath
        };
      }
    } else if (platform() === 'win32') {
      const cursorPath = join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor');
      if (existsSync(cursorPath)) {
        return {
          id: 'cursor',
          name: 'Cursor',
          version: 'unknown',
          path: cursorPath
        };
      }
    }
    
    // Try command line
    const { stdout } = await safeExec('cursor --version');
    const [version] = stdout.trim().split('\n');
    return {
      id: 'cursor',
      name: 'Cursor',
      version
    };
  } catch (error) {
    logger.debug('Cursor not found');
  }
  
  return null;
}

async function detectWindsurf(): Promise<DetectedEditor | null> {
  try {
    // Check config directory
    const configPath = join(homedir(), '.windsurf');
    if (existsSync(configPath)) {
      return {
        id: 'windsurf',
        name: 'Windsurf',
        version: 'unknown'
      };
    }
  } catch (error) {
    logger.debug('Windsurf not found');
  }
  
  return null;
}

async function detectContinue(): Promise<DetectedEditor | null> {
  try {
    // Check config directory
    const configPath = join(homedir(), '.continue');
    if (existsSync(configPath)) {
      return {
        id: 'continue',
        name: 'Continue',
        version: 'unknown'
      };
    }
  } catch (error) {
    logger.debug('Continue not found');
  }
  
  return null;
}

async function detectClaudeCode(): Promise<DetectedEditor | null> {
  try {
    // Check for claude-code command
    const { stdout } = await safeExec('claude-code --version');
    const version = stdout.trim();
    return {
      id: 'claude-code',
      name: 'Claude Code',
      version
    };
  } catch (error) {
    // Check config directory as fallback
    const configPath = join(homedir(), '.config', 'claude-code');
    if (existsSync(configPath)) {
      return {
        id: 'claude-code',
        name: 'Claude Code',
        version: 'unknown'
      };
    }
  }
  
  return null;
}