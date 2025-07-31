import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';

const execAsync = promisify(exec);

// Whitelist of allowed commands and their validators
const ALLOWED_COMMANDS = {
  'node': /^node\s+--version$/,
  'bun': /^bun\s+(--version|install)$/,
  'code': /^code\s+--version$/,
  'cursor': /^cursor\s+--version$/,
  'claude-code': /^claude-code\s+--version$/,
  'lsof': /^lsof\s+-i\s+:\d+\s*\|\s*grep\s+LISTEN\s*\|\s*awk\s+'\{print\s+\$1,\s+\$2\}'$/,
  'powershell': /^powershell\s+-Command\s+"[^"]+"|^powershell\s+-c\s+"[^"]+"/,
  'curl': /^curl\s+-fsSL\s+https:\/\/bun\.sh\/install\s*\|\s*bash$/,
  'defaults': /^defaults\s+read\s+"[^"]+"\s+CFBundleShortVersionString$/,
  'which': /^which\s+\w+$/,
  'where': /^where\s+\w+$/
};

export interface SafeExecOptions {
  cwd?: string;
  shell?: string | boolean;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
}

export class CommandValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandValidationError';
  }
}

/**
 * Safely execute a shell command with validation
 */
export async function safeExec(
  command: string,
  options: SafeExecOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  // Validate command against whitelist
  const commandName = command.split(/\s+/)[0];
  const validator = ALLOWED_COMMANDS[commandName as keyof typeof ALLOWED_COMMANDS];
  
  if (!validator) {
    throw new CommandValidationError(`Command '${commandName}' is not allowed`);
  }
  
  if (!validator.test(command)) {
    throw new CommandValidationError(`Invalid command format: ${command}`);
  }
  
  try {
    return await execAsync(command, options);
  } catch (error) {
    logger.error(`Command failed: ${command}`, error);
    throw error;
  }
}

/**
 * Execute a command with a specific argument safely
 */
export async function safeExecWithArgs(
  commandName: string,
  args: string[],
  options: SafeExecOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  // Validate command name
  if (!ALLOWED_COMMANDS[commandName as keyof typeof ALLOWED_COMMANDS]) {
    throw new CommandValidationError(`Command '${commandName}' is not allowed`);
  }
  
  // Escape arguments to prevent injection
  const escapedArgs = args.map(arg => {
    // Remove any shell metacharacters
    return arg.replace(/[;&|`$<>(){}[\]\\'"]/g, '');
  });
  
  const fullCommand = `${commandName} ${escapedArgs.join(' ')}`;
  return safeExec(fullCommand, options);
}

/**
 * Safely execute a PowerShell command
 */
export async function safePowerShell(
  script: string,
  options: SafeExecOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  // Validate PowerShell script doesn't contain dangerous patterns
  const dangerousPatterns = [
    /Remove-Item/i,
    /rm\s+-rf/i,
    /Format-/i,
    /Clear-/i,
    /Stop-Computer/i,
    /Restart-Computer/i,
    /Set-ExecutionPolicy/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(script)) {
      throw new CommandValidationError('PowerShell script contains dangerous commands');
    }
  }
  
  // Escape the script for PowerShell
  const escapedScript = script.replace(/"/g, '`"');
  const command = `powershell -Command "${escapedScript}"`;
  
  return safeExec(command, options);
}

/**
 * Safely get process information for a port
 */
export async function safeGetPortProcess(port: number): Promise<string | undefined> {
  // Validate port number
  const safePort = parseInt(port.toString(), 10);
  if (isNaN(safePort) || safePort < 0 || safePort > 65535) {
    throw new CommandValidationError('Invalid port number');
  }
  
  const { platform } = process;
  
  try {
    if (platform === 'darwin' || platform === 'linux') {
      const command = `lsof -i :${safePort} | grep LISTEN | awk '{print $1, $2}'`;
      const { stdout } = await safeExec(command);
      return stdout.trim();
    } else if (platform === 'win32') {
      const script = `Get-NetTCPConnection -LocalPort ${safePort} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 OwningProcess`;
      const { stdout } = await safePowerShell(script);
      return stdout.trim();
    }
  } catch (error) {
    logger.debug('Failed to get port process:', error);
  }
  
  return undefined;
}

/**
 * Safely install Bun
 */
export async function safeInstallBun(): Promise<void> {
  const { platform } = process;
  
  if (platform === 'win32') {
    await safePowerShell('irm bun.sh/install.ps1 | iex');
  } else {
    await safeExec('curl -fsSL https://bun.sh/install | bash');
  }
}

/**
 * Safely read plist value on macOS
 */
export async function safeReadPlist(plistPath: string, key: string): Promise<string> {
  // Validate plist path doesn't contain shell metacharacters
  if (/[;&|`$<>(){}[\]\\'"]/g.test(plistPath)) {
    throw new CommandValidationError('Invalid plist path');
  }
  
  // Validate key is alphanumeric
  if (!/^[A-Za-z0-9]+$/.test(key)) {
    throw new CommandValidationError('Invalid plist key');
  }
  
  const command = `defaults read "${plistPath}" ${key}`;
  const { stdout } = await safeExec(command);
  return stdout.trim();
}