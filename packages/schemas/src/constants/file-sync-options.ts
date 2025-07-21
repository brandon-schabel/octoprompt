// --- Constants (ALLOWED_EXTENSIONS, DEFAULT_EXCLUSIONS) remain the same ---
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

  // Backend Developmentœ
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

// File size limits for summarization
export const MAX_FILE_SIZE_FOR_SUMMARY = 1024 * 1024 // 1MB in bytes
export const MAX_TOKENS_FOR_SUMMARY = 8000 // Safe limit for most models
export const CHARS_PER_TOKEN_ESTIMATE = 4 // Rough estimate for token counting

// Example content for shared/src/constants/file-sync-options.ts
export const DEFAULT_FILE_EXCLUSIONS = [
  // --- Directories ---
  'node_modules/', // Crucial!
  '.git/', // Crucial!
  'dist/',
  'build/',
  'out/',
  'coverage/',
  '.cache/',
  '.vscode/',
  '.idea/',
  '__pycache__/',
  '.env', // Specific common file
  '.DS_Store',
  'venv/',

  // --- File Patterns ---
  '*.log',
  '*.lock', // e.g., package-lock.json, yarn.lock (handle potential need for these)
  '*.pyc',
  '*.swp',
  '*.bak',
  '*.tmp'
]

const testFileChange = {
  fileId: '123',
  content: 'Hello, world!',
  updatedAt: new Date()
}
