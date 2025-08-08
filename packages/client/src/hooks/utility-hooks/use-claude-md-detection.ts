import { useMemo } from 'react'
import { ProjectFile } from '@promptliano/schemas'

export interface ClaudeMdDetectionResult {
  hasClaudeMd: boolean
  claudeMdFile: ProjectFile | null
  claudeMdFileId: number | null
}

/**
 * Hook to detect CLAUDE.md files in directories
 * Caches results for performance
 */
export function useClaudeMdDetection(projectFiles: ProjectFile[]) {
  // Create a map of directories to their CLAUDE.md files
  const claudeMdByDirectory = useMemo(() => {
    const map = new Map<string, ProjectFile>()

    projectFiles.forEach((file) => {
      // Check if this is a CLAUDE.md file (case-insensitive)
      const fileName = file.name.toLowerCase()
      if (fileName === 'claude.md') {
        // Get the directory path (everything before the last /)
        const lastSlashIndex = file.path.lastIndexOf('/')
        const directory = lastSlashIndex > 0 ? file.path.substring(0, lastSlashIndex) : '/'

        // Store the file in the map
        map.set(directory, file)
      }
    })

    return map
  }, [projectFiles])

  /**
   * Check if a directory has a CLAUDE.md file
   */
  const getClaudeMdForDirectory = (directoryPath: string): ClaudeMdDetectionResult => {
    const claudeMdFile = claudeMdByDirectory.get(directoryPath) || null

    return {
      hasClaudeMd: claudeMdFile !== null,
      claudeMdFile,
      claudeMdFileId: claudeMdFile?.id || null
    }
  }

  /**
   * Get CLAUDE.md file for a given file path
   */
  const getClaudeMdForFile = (filePath: string): ClaudeMdDetectionResult => {
    // Get the directory of the file
    const lastSlashIndex = filePath.lastIndexOf('/')
    const directory = lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : '/'

    return getClaudeMdForDirectory(directory)
  }

  /**
   * Get all directories that have CLAUDE.md files
   */
  const directoriesWithClaudeMd = useMemo(() => {
    return Array.from(claudeMdByDirectory.keys())
  }, [claudeMdByDirectory])

  /**
   * Get all CLAUDE.md files in the project
   */
  const allClaudeMdFiles = useMemo(() => {
    return Array.from(claudeMdByDirectory.values())
  }, [claudeMdByDirectory])

  return {
    getClaudeMdForFile,
    getClaudeMdForDirectory,
    directoriesWithClaudeMd,
    allClaudeMdFiles,
    claudeMdByDirectory
  }
}
