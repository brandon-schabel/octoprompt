import type { ProjectFile, FileImportance } from '@octoprompt/schemas'

// File type weights for importance scoring
const FILE_TYPE_WEIGHTS: Record<string, number> = {
  // Core application files
  'service.ts': 3.0,
  'service.js': 3.0,
  'api.ts': 2.5,
  'api.js': 2.5,
  'route.ts': 2.5,
  'route.js': 2.5,
  'controller.ts': 2.5,
  'controller.js': 2.5,
  
  // Configuration and schema files
  'schema.ts': 2.0,
  'schemas.ts': 2.0,
  'config.ts': 2.0,
  'config.js': 2.0,
  '.env': 2.0,
  
  // Entry points
  'index.ts': 2.0,
  'index.js': 2.0,
  'main.ts': 2.0,
  'main.js': 2.0,
  'app.ts': 2.0,
  'app.js': 2.0,
  
  // React components
  '.tsx': 1.5,
  '.jsx': 1.5,
  
  // Regular source files
  '.ts': 1.0,
  '.js': 1.0,
  '.py': 1.0,
  '.go': 1.0,
  '.rs': 1.0,
  
  // Test files (lower priority)
  '.test.ts': 0.5,
  '.test.js': 0.5,
  '.spec.ts': 0.5,
  '.spec.js': 0.5,
  
  // Documentation
  '.md': 0.3,
  '.txt': 0.2,
  
  // Assets and other
  '.json': 0.5,
  '.yaml': 0.5,
  '.yml': 0.5,
  '.css': 0.3,
  '.scss': 0.3
}

// Directory importance weights
const DIRECTORY_WEIGHTS: Record<string, number> = {
  'src': 2.0,
  'services': 2.5,
  'api': 2.5,
  'routes': 2.5,
  'controllers': 2.5,
  'components': 1.5,
  'hooks': 1.5,
  'utils': 1.0,
  'lib': 1.0,
  'core': 2.0,
  'domain': 2.0,
  'test': 0.5,
  'tests': 0.5,
  '__tests__': 0.5,
  'docs': 0.3,
  'examples': 0.3,
  'node_modules': 0.1,
  '.git': 0.1
}

/**
 * Calculate importance score for a file based on multiple factors
 */
export function getFileImportance(file: ProjectFile): FileImportance {
  const factors = {
    type: getFileTypeScore(file.name),
    location: getLocationScore(file.path),
    imports: getImportScore(file.imports?.length || 0),
    exports: getExportScore(file.exports?.length || 0),
    size: getFileSizeScore(file.size || 0),
    recency: getRecencyScore(file.updated)
  }
  
  // Calculate weighted total score
  const score = Math.min(10, 
    factors.type * 0.3 +
    factors.location * 0.2 +
    factors.imports * 0.15 +
    factors.exports * 0.15 +
    factors.size * 0.1 +
    factors.recency * 0.1
  )
  
  return {
    fileId: file.id,
    score,
    factors
  }
}

/**
 * Get score based on file type/extension
 */
function getFileTypeScore(filename: string): number {
  const lowerName = filename.toLowerCase()
  
  // Check specific file patterns first
  for (const [pattern, weight] of Object.entries(FILE_TYPE_WEIGHTS)) {
    if (pattern.startsWith('.') && lowerName.endsWith(pattern)) {
      return weight
    } else if (lowerName.includes(pattern)) {
      return weight
    }
  }
  
  // Extract extension
  const ext = '.' + lowerName.split('.').pop()
  return FILE_TYPE_WEIGHTS[ext] || 0.1
}

/**
 * Get score based on file location in directory structure
 */
function getLocationScore(path: string): number {
  const parts = path.toLowerCase().split('/')
  let maxScore = 1.0
  
  for (const part of parts) {
    const dirWeight = DIRECTORY_WEIGHTS[part]
    if (dirWeight !== undefined) {
      maxScore = Math.max(maxScore, dirWeight)
    }
  }
  
  // Bonus for files closer to root (fewer directory levels)
  const depthPenalty = Math.max(0, 1 - (parts.length - 1) * 0.1)
  
  return maxScore * depthPenalty
}

/**
 * Get score based on number of imports (indicates dependencies)
 */
function getImportScore(importCount: number): number {
  if (importCount === 0) return 0.5
  if (importCount <= 5) return 1.0
  if (importCount <= 10) return 1.5
  if (importCount <= 20) return 2.0
  return 2.5 // Many imports = likely important integration point
}

/**
 * Get score based on number of exports (indicates API surface)
 */
function getExportScore(exportCount: number): number {
  if (exportCount === 0) return 0.5
  if (exportCount <= 3) return 1.0
  if (exportCount <= 10) return 2.0
  if (exportCount <= 20) return 2.5
  return 3.0 // Many exports = likely important module
}

/**
 * Get score based on file size (moderate size files are often more important)
 */
function getFileSizeScore(size: number): number {
  if (size === 0) return 0.1
  if (size < 100) return 0.5 // Very small files
  if (size < 1000) return 1.0
  if (size < 10000) return 2.0 // Sweet spot
  if (size < 50000) return 1.5
  return 1.0 // Very large files might be generated or less important
}

/**
 * Get score based on how recently the file was modified
 */
function getRecencyScore(lastUpdated: number): number {
  const now = Date.now()
  const age = now - lastUpdated
  const daysOld = age / (1000 * 60 * 60 * 24)
  
  if (daysOld < 1) return 3.0 // Modified today
  if (daysOld < 7) return 2.5 // Modified this week
  if (daysOld < 30) return 2.0 // Modified this month
  if (daysOld < 90) return 1.5 // Modified this quarter
  if (daysOld < 365) return 1.0 // Modified this year
  return 0.5 // Older files
}

/**
 * Sort files by importance score (descending)
 */
export function sortFilesByImportance(files: ProjectFile[]): ProjectFile[] {
  const filesWithScores = files.map(file => ({
    file,
    importance: getFileImportance(file)
  }))
  
  filesWithScores.sort((a, b) => b.importance.score - a.importance.score)
  
  return filesWithScores.map(item => item.file)
}

/**
 * Get top N most important files
 */
export function getTopImportantFiles(files: ProjectFile[], topN: number): ProjectFile[] {
  return sortFilesByImportance(files).slice(0, topN)
}

/**
 * Filter files by minimum importance score
 */
export function filterByImportance(files: ProjectFile[], minScore: number): ProjectFile[] {
  return files.filter(file => getFileImportance(file).score >= minScore)
}