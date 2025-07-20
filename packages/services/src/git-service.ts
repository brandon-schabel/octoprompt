import { simpleGit, type SimpleGit, type StatusResult, type FileStatusResult } from 'simple-git'
import type {
  GitStatus,
  GitFileStatus,
  GitStatusResult,
  GitFileStatusType
} from '@octoprompt/schemas'
import { getProjectById } from './project-service'
import { ApiError } from '@octoprompt/shared'
import path from 'path'

interface GitStatusCache {
  status: GitStatus
  timestamp: number
}

const gitStatusCache = new Map<number, GitStatusCache>()
const CACHE_TTL = 5000 // 5 seconds

function getGitFileStatus(file: FileStatusResult): GitFileStatusType {
  if (file.index === 'A' || file.working_dir === 'A') return 'added'
  if (file.index === 'D' || file.working_dir === 'D') return 'deleted'
  if (file.index === 'M' || file.working_dir === 'M') return 'modified'
  if (file.index === 'R' || file.working_dir === 'R') return 'renamed'
  if (file.index === 'C' || file.working_dir === 'C') return 'copied'
  if (file.index === '?' && file.working_dir === '?') return 'untracked'
  if (file.index === '!' && file.working_dir === '!') return 'ignored'
  return 'unchanged'
}

function mapGitStatusToSchema(status: StatusResult, projectPath: string): GitStatus {
  const files: GitFileStatus[] = status.files.map(file => ({
    path: file.path,
    status: getGitFileStatus(file),
    staged: file.index !== ' ' && file.index !== '?',
    index: file.index || null,
    workingDir: file.working_dir || null,
  }))

  return {
    isRepo: true,
    current: status.current || null,
    tracking: status.tracking || null,
    ahead: status.ahead,
    behind: status.behind,
    files,
    staged: status.staged,
    modified: status.modified,
    created: status.created,
    deleted: status.deleted,
    renamed: status.renamed.map(r => r.to),
    conflicted: status.conflicted,
  }
}

export async function getProjectGitStatus(projectId: number): Promise<GitStatusResult> {
  try {
    // Check cache first
    const cached = gitStatusCache.get(projectId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        success: true,
        data: cached.status,
      }
    }

    // Get project to ensure it exists and get its path
    const project = await getProjectById(projectId)
    if (!project.path) {
      return {
        success: false,
        error: {
          type: 'not_a_repo',
          message: 'Project does not have a path associated with it',
        },
      }
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    try {
      // Check if it's a git repository
      const isRepo = await git.checkIsRepo()
      if (!isRepo) {
        return {
          success: false,
          error: {
            type: 'not_a_repo',
            message: 'The project directory is not a git repository',
          },
        }
      }

      // Get the status
      const status = await git.status()
      const gitStatus = mapGitStatusToSchema(status, projectPath)

      // Cache the result
      gitStatusCache.set(projectId, {
        status: gitStatus,
        timestamp: Date.now(),
      })

      return {
        success: true,
        data: gitStatus,
      }
    } catch (error) {
      // Handle specific git errors
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes('not a git repository')) {
        return {
          success: false,
          error: {
            type: 'not_a_repo',
            message: 'The project directory is not a git repository',
          },
        }
      }

      if (errorMessage.includes('git: command not found') || errorMessage.includes('git not found')) {
        return {
          success: false,
          error: {
            type: 'git_not_installed',
            message: 'Git is not installed on the system',
          },
        }
      }

      if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
        return {
          success: false,
          error: {
            type: 'permission_denied',
            message: 'Permission denied when accessing the git repository',
          },
        }
      }

      return {
        success: false,
        error: {
          type: 'unknown',
          message: errorMessage,
        },
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get git status: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_STATUS_FAILED'
    )
  }
}

export function clearGitStatusCache(projectId?: number): void {
  if (projectId !== undefined) {
    gitStatusCache.delete(projectId)
  } else {
    gitStatusCache.clear()
  }
}