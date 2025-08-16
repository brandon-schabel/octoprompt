import { join } from 'node:path'
import { homedir, platform, tmpdir } from 'node:os'
import type { DatabaseConfig } from '../types'

// Check if we're in a browser environment
const isBrowser = typeof globalThis !== 'undefined' && 'window' in globalThis

// Safe environment variable access
const getEnvVar = (key: string, defaultValue?: string): string | undefined => {
  if (isBrowser) {
    return defaultValue
  }
  return process?.env?.[key] || defaultValue
}

// Get platform-appropriate data directory
function getPlatformDataDirectory(): string {
  if (isBrowser) {
    return './data'
  }

  const currentPlatform = platform()
  const home = homedir()

  switch (currentPlatform) {
    case 'darwin': // macOS
      return join(home, 'Library', 'Application Support', 'Promptliano')
    case 'win32': // Windows
      return join(getEnvVar('APPDATA') || join(home, 'AppData', 'Roaming'), 'Promptliano')
    case 'linux': // Linux
      return join(getEnvVar('XDG_DATA_HOME') || join(home, '.local', 'share'), 'promptliano')
    default:
      // Fallback to home directory
      return join(home, '.promptliano')
  }
}

// Determine database path based on environment
function getDatabasePath(): string {
  // Priority 1: Environment variable override
  const envPath = getEnvVar('DATABASE_PATH')
  if (envPath) {
    return envPath
  }

  // Priority 2: Docker/container environment
  if (getEnvVar('PROMPTLIANO_DATA_DIR')) {
    return join(getEnvVar('PROMPTLIANO_DATA_DIR')!, 'promptliano.db')
  }

  // Priority 3: Test environment
  if (getEnvVar('NODE_ENV') === 'test') {
    return ':memory:'
  }

  // Priority 4: Platform-specific default
  const dataDir = getPlatformDataDirectory()
  return join(dataDir, 'promptliano.db')
}

export const databaseConfig: DatabaseConfig = {
  // Database file configuration
  path: getDatabasePath(),
  dataDir: getEnvVar('PROMPTLIANO_DATA_DIR') || getPlatformDataDirectory(),

  // Backup configuration
  backupEnabled: getEnvVar('DATABASE_BACKUP_ENABLED', 'true') === 'true',
  backupInterval: Number(getEnvVar('DATABASE_BACKUP_INTERVAL', '3600000')), // 1 hour default
  maxBackups: Number(getEnvVar('DATABASE_MAX_BACKUPS', '10')),

  // Performance settings
  walMode: getEnvVar('DATABASE_WAL_MODE', 'true') === 'true',
  cacheSize: Number(getEnvVar('DATABASE_CACHE_SIZE', '64')), // 64MB default
  tempStore: (getEnvVar('DATABASE_TEMP_STORE', 'memory') as 'memory' | 'file'),
  mmapSize: Number(getEnvVar('DATABASE_MMAP_SIZE', '268435456')), // 256MB default

  // Platform-specific paths for reference
  platformDefaults: {
    darwin: join(homedir(), 'Library', 'Application Support', 'Promptliano', 'promptliano.db'),
    win32: join(getEnvVar('APPDATA') || join(homedir(), 'AppData', 'Roaming'), 'Promptliano', 'promptliano.db'),
    linux: join(getEnvVar('XDG_DATA_HOME') || join(homedir(), '.local', 'share'), 'promptliano', 'promptliano.db'),
    fallback: join(homedir(), '.promptliano', 'promptliano.db')
  }
}