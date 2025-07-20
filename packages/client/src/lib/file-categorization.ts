import { ProjectFile } from '@octoprompt/schemas'

// Common binary file extensions
const BINARY_EXTENSIONS = new Set([
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg', '.webp', '.tiff',
  // Videos
  '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm',
  // Audio
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a',
  // Archives
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Executables
  '.exe', '.dll', '.so', '.dylib', '.app',
  // Data
  '.db', '.sqlite', '.mdb',
  // Other
  '.bin', '.dat', '.iso', '.dmg', '.pkg', '.deb', '.rpm',
  // Fonts
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  // Models/Data files
  '.pkl', '.h5', '.model', '.weights', '.onnx',
])

// File size limit for summarization (from schemas)
const MAX_FILE_SIZE_FOR_SUMMARY = 1024 * 1024 // 1MB

export interface FileCategory {
  category: 'summarized' | 'pending' | 'binary' | 'too-large' | 'empty' | 'error'
  reason?: string
}

export interface FileCategorization {
  summarized: ProjectFile[]
  pending: ProjectFile[]
  binary: ProjectFile[]
  tooLarge: ProjectFile[]
  empty: ProjectFile[]
  error: ProjectFile[]
  summarizable: ProjectFile[] // Files that can be summarized (pending + error)
  nonSummarizable: ProjectFile[] // Files that cannot be summarized (binary + tooLarge + empty)
}

export interface SummarizationStats {
  total: number
  summarized: number
  pending: number
  binary: number
  tooLarge: number
  empty: number
  error: number
  summarizable: number
  nonSummarizable: number
  coveragePercentage: number // (summarized / summarizable) * 100
  totalPercentage: number // (summarized / total) * 100
}

/**
 * Check if a file is binary based on its extension
 */
export function isBinaryFile(filePath: string): boolean {
  const extension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return BINARY_EXTENSIONS.has(extension)
}

/**
 * Categorize a single file based on its properties
 */
export function categorizeFile(file: ProjectFile): FileCategory {
  if (file.summary) {
    return { category: 'summarized' }
  }

  // Check if binary
  if (isBinaryFile(file.path)) {
    return { category: 'binary', reason: 'Binary file type' }
  }

  // Check if too large
  if (file.size > MAX_FILE_SIZE_FOR_SUMMARY) {
    return { 
      category: 'too-large', 
      reason: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 1MB limit` 
    }
  }

  // Check if empty
  if (!file.content || file.content.trim().length === 0) {
    return { category: 'empty', reason: 'File is empty or contains only whitespace' }
  }

  // If none of the above, it's pending summarization
  return { category: 'pending', reason: 'Awaiting summarization' }
}

/**
 * Categorize all files in a project
 */
export function categorizeProjectFiles(files: ProjectFile[]): FileCategorization {
  const categorization: FileCategorization = {
    summarized: [],
    pending: [],
    binary: [],
    tooLarge: [],
    empty: [],
    error: [],
    summarizable: [],
    nonSummarizable: []
  }

  for (const file of files) {
    const { category } = categorizeFile(file)
    
    switch (category) {
      case 'summarized':
        categorization.summarized.push(file)
        break
      case 'pending':
        categorization.pending.push(file)
        categorization.summarizable.push(file)
        break
      case 'binary':
        categorization.binary.push(file)
        categorization.nonSummarizable.push(file)
        break
      case 'too-large':
        categorization.tooLarge.push(file)
        categorization.nonSummarizable.push(file)
        break
      case 'empty':
        categorization.empty.push(file)
        categorization.nonSummarizable.push(file)
        break
      case 'error':
        categorization.error.push(file)
        categorization.summarizable.push(file)
        break
    }
  }

  return categorization
}

/**
 * Get summarization statistics for a project
 */
export function getSummarizationStats(files: ProjectFile[]): SummarizationStats {
  const categorization = categorizeProjectFiles(files)
  
  const total = files.length
  const summarizable = categorization.summarized.length + categorization.pending.length + categorization.error.length
  
  const stats: SummarizationStats = {
    total,
    summarized: categorization.summarized.length,
    pending: categorization.pending.length,
    binary: categorization.binary.length,
    tooLarge: categorization.tooLarge.length,
    empty: categorization.empty.length,
    error: categorization.error.length,
    summarizable,
    nonSummarizable: categorization.nonSummarizable.length,
    coveragePercentage: summarizable > 0 ? (categorization.summarized.length / summarizable) * 100 : 0,
    totalPercentage: total > 0 ? (categorization.summarized.length / total) * 100 : 0
  }

  return stats
}

/**
 * Get a human-readable description for file count
 */
export function getFileCountDescription(count: number, total: number): string {
  const percentage = total > 0 ? (count / total * 100).toFixed(1) : '0'
  return `${count} file${count !== 1 ? 's' : ''} (${percentage}%)`
}