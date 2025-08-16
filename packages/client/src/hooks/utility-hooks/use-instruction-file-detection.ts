import { useMemo } from 'react'
import { ProjectFile } from '@promptliano/schemas'
import * as path from 'path-browserify'
import * as os from 'os'

export type InstructionFileType =
  | 'claude'
  | 'agents'
  | 'copilot'
  | 'cursor'
  | 'aider'
  | 'codebase'
  | 'windsurf'
  | 'continue'

export interface InstructionFilePattern {
  type: InstructionFileType
  name: string
  patterns: string[]
  globalPatterns?: string[]
}

export interface DetectedInstructionFile {
  type: InstructionFileType
  name: string
  file: ProjectFile
  isGlobal: boolean
}

export interface InstructionFileDetectionResult {
  hasInstructionFiles: boolean
  instructionFiles: DetectedInstructionFile[]
  instructionFilesByType: Map<InstructionFileType, DetectedInstructionFile[]>
}

// Define the patterns for each instruction file type
const instructionFilePatterns: InstructionFilePattern[] = [
  {
    type: 'claude',
    name: 'Claude',
    patterns: ['CLAUDE.md', '.claude/CLAUDE.md'],
    globalPatterns: ['.claude/CLAUDE.md', 'CLAUDE.md']
  },
  {
    type: 'agents',
    name: 'Agents',
    patterns: ['AGENTS.md', '.agents/AGENTS.md'],
    globalPatterns: ['.agents/AGENTS.md', 'AGENTS.md']
  },
  {
    type: 'copilot',
    name: 'GitHub Copilot',
    patterns: ['copilot-instructions.md', '.github/copilot-instructions.md']
  },
  {
    type: 'cursor',
    name: 'Cursor',
    patterns: ['.cursorrules', '.cursor/rules.md']
  },
  {
    type: 'aider',
    name: 'Aider',
    patterns: ['.aider', '.aider.conf.yml', '.aider/aider.conf.yml'],
    globalPatterns: ['.aider.conf.yml']
  },
  {
    type: 'codebase',
    name: 'Codebase Instructions',
    patterns: ['codebase-instructions.md', '.ai/instructions.md', 'AI_INSTRUCTIONS.md', 'docs/ai-instructions.md']
  },
  {
    type: 'windsurf',
    name: 'Windsurf',
    patterns: ['.windsurf/rules.md', '.windsurfrules']
  },
  {
    type: 'continue',
    name: 'Continue',
    patterns: ['.continue/config.json'],
    globalPatterns: ['.continue/config.json']
  }
]

/**
 * Hook to detect instruction files (CLAUDE.md, copilot-instructions.md, etc.) in directories
 * Caches results for performance
 */
export function useInstructionFileDetection(projectFiles: ProjectFile[], projectPath?: string) {
  // Create a map of directories to their instruction files by type
  const instructionFilesByDirectory = useMemo(() => {
    const map = new Map<string, Map<InstructionFileType, ProjectFile>>()

    projectFiles.forEach((file) => {
      // Check each pattern to see if this file matches
      for (const pattern of instructionFilePatterns) {
        const fileName = file.name.toLowerCase()
        const filePath = file.path.toLowerCase()

        // Check if file matches any of the patterns for this type
        const isMatch = pattern.patterns.some((p) => {
          const patternLower = p.toLowerCase()
          // Check both file name and full path
          return (
            fileName === path.basename(patternLower) ||
            filePath.endsWith(patternLower) ||
            filePath.includes('/' + patternLower)
          )
        })

        if (isMatch) {
          // Get the directory path (everything before the last /)
          const lastSlashIndex = file.path.lastIndexOf('/')
          const directory = lastSlashIndex > 0 ? file.path.substring(0, lastSlashIndex) : '/'

          // Get or create the map for this directory
          if (!map.has(directory)) {
            map.set(directory, new Map())
          }

          const dirMap = map.get(directory)!
          // Store the file for this type (last one wins if multiple)
          dirMap.set(pattern.type, file)
        }
      }
    })

    return map
  }, [projectFiles])

  /**
   * Check if a directory has any instruction files
   */
  const getInstructionFilesForDirectory = (
    directoryPath: string,
    enabledTypes: InstructionFileType[] = ['claude'],
    priority: InstructionFileType = 'claude'
  ): InstructionFileDetectionResult => {
    const dirFiles = instructionFilesByDirectory.get(directoryPath)

    if (!dirFiles || dirFiles.size === 0) {
      return {
        hasInstructionFiles: false,
        instructionFiles: [],
        instructionFilesByType: new Map()
      }
    }

    const detectedFiles: DetectedInstructionFile[] = []
    const filesByType = new Map<InstructionFileType, DetectedInstructionFile[]>()

    // Check each enabled type
    for (const type of enabledTypes) {
      const file = dirFiles.get(type)
      if (file) {
        const pattern = instructionFilePatterns.find((p) => p.type === type)!
        const detected: DetectedInstructionFile = {
          type,
          name: pattern.name,
          file,
          isGlobal: false
        }

        detectedFiles.push(detected)

        if (!filesByType.has(type)) {
          filesByType.set(type, [])
        }
        filesByType.get(type)!.push(detected)
      }
    }

    // Sort by priority - put the priority type first if it exists
    detectedFiles.sort((a, b) => {
      if (a.type === priority) return -1
      if (b.type === priority) return 1
      return 0
    })

    return {
      hasInstructionFiles: detectedFiles.length > 0,
      instructionFiles: detectedFiles,
      instructionFilesByType: filesByType
    }
  }

  /**
   * Get instruction files for a given file path (gets the directory of the file)
   */
  const getInstructionFilesForFile = (
    filePath: string,
    enabledTypes: InstructionFileType[] = ['claude'],
    priority: InstructionFileType = 'claude'
  ): InstructionFileDetectionResult => {
    // Get the directory of the file
    const lastSlashIndex = filePath.lastIndexOf('/')
    const directory = lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : '/'

    return getInstructionFilesForDirectory(directory, enabledTypes, priority)
  }

  /**
   * Get all directories that have instruction files
   */
  const directoriesWithInstructionFiles = useMemo(() => {
    return Array.from(instructionFilesByDirectory.keys())
  }, [instructionFilesByDirectory])

  /**
   * Get all instruction files in the project grouped by type
   */
  const allInstructionFilesByType = useMemo(() => {
    const byType = new Map<InstructionFileType, ProjectFile[]>()

    for (const [, dirMap] of instructionFilesByDirectory) {
      for (const [type, file] of dirMap) {
        if (!byType.has(type)) {
          byType.set(type, [])
        }
        byType.get(type)!.push(file)
      }
    }

    return byType
  }, [instructionFilesByDirectory])

  /**
   * Get instruction files from the project root
   */
  const getProjectRootInstructionFiles = (
    enabledTypes: InstructionFileType[] = ['claude', 'agents']
  ): DetectedInstructionFile[] => {
    const rootFiles: DetectedInstructionFile[] = []

    // Check each enabled type for files at project root
    for (const type of enabledTypes) {
      const pattern = instructionFilePatterns.find((p) => p.type === type)
      if (!pattern) continue

      // Check if any project files match the root patterns for this type
      for (const filePattern of pattern.patterns) {
        // Check for exact match at root (e.g., /CLAUDE.md or /.github/copilot-instructions.md)
        const matchingFile = projectFiles.find((file) => {
          // Remove leading slash if present for comparison
          const normalizedPath = file.path.startsWith('/') ? file.path.substring(1) : file.path
          const normalizedPattern = filePattern.startsWith('/') ? filePattern.substring(1) : filePattern

          // Check if this is a root-level file (no additional path segments before the pattern)
          return (
            normalizedPath === normalizedPattern || normalizedPath.toLowerCase() === normalizedPattern.toLowerCase()
          )
        })

        if (matchingFile) {
          rootFiles.push({
            type,
            name: pattern.name,
            file: matchingFile,
            isGlobal: false // These are project-root files, not global system files
          })
          break // Only add one file per type
        }
      }
    }

    return rootFiles
  }

  /**
   * Get global instruction files (mock for now - would need actual file system access)
   * In a real implementation, this would check the user's home directory
   */
  const getGlobalInstructionFiles = (): DetectedInstructionFile[] => {
    // This is a placeholder - in a real web app, we'd need to call
    // a backend service to check for global files
    return []
  }

  /**
   * Get the best instruction file for a directory based on priority
   */
  const getBestInstructionFile = (
    directoryPath: string,
    enabledTypes: InstructionFileType[] = ['claude'],
    priority: InstructionFileType = 'claude'
  ): DetectedInstructionFile | null => {
    const result = getInstructionFilesForDirectory(directoryPath, enabledTypes, priority)

    if (!result.hasInstructionFiles) {
      return null
    }

    // First try to return the priority type if it exists
    const priorityFile = result.instructionFiles.find((f) => f.type === priority)
    if (priorityFile) {
      return priorityFile
    }

    // Otherwise return the first one
    return result.instructionFiles[0] || null
  }

  /**
   * Get all parent directories from a given path up to the root
   */
  const getParentDirectories = (filePath: string): string[] => {
    const directories: string[] = []
    let currentPath = filePath

    // Start with the directory of the file (not the file itself)
    const lastSlashIndex = currentPath.lastIndexOf('/')
    if (lastSlashIndex > 0) {
      currentPath = currentPath.substring(0, lastSlashIndex)
    } else {
      return []
    }

    // Traverse up the directory tree
    while (currentPath && currentPath !== '/') {
      directories.push(currentPath)
      const parentSlashIndex = currentPath.lastIndexOf('/')
      if (parentSlashIndex <= 0) {
        break
      }
      currentPath = currentPath.substring(0, parentSlashIndex)
    }

    // Add root if we're not already there
    if (currentPath === '' || directories[directories.length - 1] !== '/') {
      directories.push('/')
    }

    return directories
  }

  /**
   * Get instruction files from all directories in the hierarchy from a file path up to the project root
   */
  const getInstructionFilesInHierarchy = (
    filePath: string,
    enabledTypes: InstructionFileType[] = ['claude'],
    priority: InstructionFileType = 'claude',
    includeProjectRoot: boolean = true,
    includeGlobal: boolean = false
  ): DetectedInstructionFile[] => {
    const allInstructionFiles: DetectedInstructionFile[] = []
    const seenPaths = new Set<string>() // To avoid duplicates

    // Get all parent directories from the file path up to root
    const parentDirs = getParentDirectories(filePath)

    // Collect instruction files from each directory level
    for (const dir of parentDirs) {
      const result = getInstructionFilesForDirectory(dir, enabledTypes, priority)

      for (const instructionFile of result.instructionFiles) {
        // Avoid duplicates based on file path
        if (!seenPaths.has(instructionFile.file.path)) {
          seenPaths.add(instructionFile.file.path)
          allInstructionFiles.push(instructionFile)
        }
      }
    }

    // Add project root instruction files if enabled
    if (includeProjectRoot) {
      const rootFiles = getProjectRootInstructionFiles(enabledTypes)
      for (const rootFile of rootFiles) {
        if (!seenPaths.has(rootFile.file.path)) {
          seenPaths.add(rootFile.file.path)
          allInstructionFiles.push(rootFile)
        }
      }
    }

    // Add global instruction files if enabled
    if (includeGlobal) {
      const globalFiles = getGlobalInstructionFiles()
      for (const globalFile of globalFiles) {
        if (!seenPaths.has(globalFile.file.path)) {
          seenPaths.add(globalFile.file.path)
          allInstructionFiles.push(globalFile)
        }
      }
    }

    // Sort by directory depth (files closer to the selected file come first)
    // and by priority within the same directory level
    allInstructionFiles.sort((a, b) => {
      // First sort by path length (shorter = closer to root, should come later)
      const depthA = a.file.path.split('/').length
      const depthB = b.file.path.split('/').length

      if (depthA !== depthB) {
        return depthB - depthA // Higher depth (more specific) comes first
      }

      // Within same depth, sort by priority
      if (a.type === priority && b.type !== priority) return -1
      if (b.type === priority && a.type !== priority) return 1

      return 0
    })

    return allInstructionFiles
  }

  return {
    getInstructionFilesForFile,
    getInstructionFilesForDirectory,
    getBestInstructionFile,
    getInstructionFilesInHierarchy,
    getParentDirectories,
    directoriesWithInstructionFiles,
    allInstructionFilesByType,
    instructionFilesByDirectory,
    getProjectRootInstructionFiles,
    getGlobalInstructionFiles
  }
}
