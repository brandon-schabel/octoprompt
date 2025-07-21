import type { FilesConfig } from '../types'

export const ALLOWED_FILE_CONFIGS = [
  // Documentation & Config
  '.md',
  'mdc',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.ini',
  '.conf',
  '.config',
  '.env',

  // Web Development
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.cjs',
  '.cts',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.vue',
  '.svelte',
  '.svg',

  // Backend Development
  '.py',
  '.rb',
  '.php',
  '.java',
  '.go',
  '.rs',
  '.cs',
  '.cpp',
  '.c',
  '.h',
  '.hpp',

  // Shell & Scripts
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.bat',
  '.ps1',

  // Database & Query
  '.sql',
  '.prisma',
  '.graphql',
  '.gql',

  // Other Languages
  '.zig',
  '.lua',
  '.r',
  '.kt',
  '.swift',
  '.m',
  '.mm',
  '.scala',
  '.clj',
  '.ex',
  '.exs',
  'ino',

  // Environment & Version
  '.cursor',
  '.env',

  // Docker & Container
  'Dockerfile',
  '.dockerignore',
  'docker-compose.yml',

  // Git
  '.gitignore',
  '.gitattributes'
]

export const DEFAULT_FILE_EXCLUSIONS = [
  // --- Directories ---
  'node_modules/',
  '.git/',
  'dist/',
  'build/',
  'out/',
  'coverage/',
  '.cache/',
  '.vscode/',
  '.idea/',
  '__pycache__/',
  '.env',
  '.DS_Store',
  'venv/',

  // --- File Patterns ---
  '*.log',
  '*.lock',
  '*.pyc',
  '*.swp',
  '*.bak',
  '*.tmp'
]

// Export individual constants for backward compatibility
export const MAX_FILE_SIZE_FOR_SUMMARY = 1024 * 1024 // 1MB in bytes
export const MAX_TOKENS_FOR_SUMMARY = 8000
export const CHARS_PER_TOKEN_ESTIMATE = 4

export const filesConfig: FilesConfig = {
  allowedExtensions: ALLOWED_FILE_CONFIGS,
  defaultExclusions: DEFAULT_FILE_EXCLUSIONS,
  maxFileSizeForSummary: MAX_FILE_SIZE_FOR_SUMMARY,
  maxTokensForSummary: MAX_TOKENS_FOR_SUMMARY,
  charsPerTokenEstimate: CHARS_PER_TOKEN_ESTIMATE
}