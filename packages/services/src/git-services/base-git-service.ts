import { simpleGit, type SimpleGit } from 'simple-git'
import { ApiError } from '@promptliano/shared'
import { getProjectById } from '../project-service'
import { createLogger } from '../utils/logger'
import * as path from 'path'

/**
 * Base class for all Git services providing common functionality
 */
export abstract class BaseGitService {
  protected readonly logger = createLogger(this.constructor.name)

  /**
   * Get git instance for a project
   */
  protected async getGitInstance(projectId: number): Promise<{ git: SimpleGit; projectPath: string }> {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git = simpleGit(projectPath)

    return { git, projectPath }
  }

  /**
   * Check if directory is a git repository
   */
  protected async checkIsRepo(git: SimpleGit): Promise<boolean> {
    try {
      return await git.checkIsRepo()
    } catch (error) {
      return false
    }
  }

  /**
   * Handle common git errors
   */
  protected handleGitError(error: unknown, operation: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes('not a git repository')) {
      throw new ApiError(400, 'The project directory is not a git repository', 'NOT_A_REPO')
    }

    if (errorMessage.includes('git: command not found') || errorMessage.includes('git not found')) {
      throw new ApiError(500, 'Git is not installed on the system', 'GIT_NOT_INSTALLED')
    }

    if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
      throw new ApiError(403, 'Permission denied when accessing the git repository', 'PERMISSION_DENIED')
    }

    throw new ApiError(
      500,
      `Git ${operation} failed: ${errorMessage}`,
      `GIT_${operation.toUpperCase().replace(/ /g, '_')}_FAILED`
    )
  }

  /**
   * Convert absolute paths to relative paths
   */
  protected toRelativePaths(projectPath: string, filePaths: string[]): string[] {
    return filePaths.map((filePath) => {
      if (path.isAbsolute(filePath)) {
        return path.relative(projectPath, filePath)
      }
      return filePath
    })
  }
}