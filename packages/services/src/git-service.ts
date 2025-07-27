import {
  simpleGit,
  type SimpleGit,
  type StatusResult,
  type FileStatusResult,
  type LogResult,
  type BranchSummary
} from 'simple-git'
import type {
  GitStatus,
  GitFileStatus,
  GitStatusResult,
  GitFileStatusType,
  GitBranch,
  GitCommit,
  GitLogEntry,
  GitDiff,
  GitRemote,
  GitTag,
  GitStash,
  GitBlame,
  GitBlameLine,
  GitCommitEnhanced,
  GitBranchEnhanced,
  GitLogEnhancedRequest,
  GitLogEnhancedResponse,
  GitBranchListEnhancedResponse,
  GitFileStats,
  GitFileDiff,
  GitCommitDetailResponse,
  GitWorktree
} from '@promptliano/schemas'
import { getProjectById } from './project-service'
import { ApiError } from '@promptliano/shared'
import path from 'path'
import { retryOperation } from './utils/retry-operation'
import { createLogger } from './utils/logger'

const logger = createLogger('GitService')

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
  const files: GitFileStatus[] = status.files.map((file) => ({
    path: file.path,
    status: getGitFileStatus(file),
    staged: file.index !== ' ' && file.index !== '?',
    index: file.index || null,
    workingDir: file.working_dir || null
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
    renamed: status.renamed.map((r) => r.to),
    conflicted: status.conflicted
  }
}

export async function getProjectGitStatus(projectId: number): Promise<GitStatusResult> {
  try {
    // Check cache first
    const cached = gitStatusCache.get(projectId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        success: true,
        data: cached.status
      }
    }

    // Get project to ensure it exists and get its path
    const project = await getProjectById(projectId)
    if (!project.path) {
      return {
        success: false,
        error: {
          type: 'not_a_repo',
          message: 'Project does not have a path associated with it'
        }
      }
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    try {
      // Check if it's a git repository
      const isRepo = await retryOperation(() => git.checkIsRepo(), {
        maxAttempts: 2,
        shouldRetry: (error) => {
          // Retry on network errors or temporary issues
          return (
            error.message?.includes('ENOENT') === false && (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT')
          )
        }
      })
      if (!isRepo) {
        return {
          success: false,
          error: {
            type: 'not_a_repo',
            message: 'The project directory is not a git repository'
          }
        }
      }

      // Get the status with retry for network issues
      const status = await retryOperation(() => git.status(), {
        maxAttempts: 3,
        shouldRetry: (error) => {
          // Retry on network errors (for remote tracking)
          return (
            error.code === 'ENOTFOUND' ||
            error.code === 'ETIMEDOUT' ||
            error.message?.includes('Could not read from remote repository')
          )
        }
      })
      const gitStatus = mapGitStatusToSchema(status, projectPath)

      // Cache the result
      gitStatusCache.set(projectId, {
        status: gitStatus,
        timestamp: Date.now()
      })

      return {
        success: true,
        data: gitStatus
      }
    } catch (error) {
      // Handle specific git errors
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes('not a git repository')) {
        return {
          success: false,
          error: {
            type: 'not_a_repo',
            message: 'The project directory is not a git repository'
          }
        }
      }

      if (errorMessage.includes('git: command not found') || errorMessage.includes('git not found')) {
        return {
          success: false,
          error: {
            type: 'git_not_installed',
            message: 'Git is not installed on the system'
          }
        }
      }

      if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
        return {
          success: false,
          error: {
            type: 'permission_denied',
            message: 'Permission denied when accessing the git repository'
          }
        }
      }

      return {
        success: false,
        error: {
          type: 'unknown',
          message: errorMessage
        }
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

export async function stageFiles(projectId: number, filePaths: string[]): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    // Convert absolute paths to relative paths if needed
    const relativePaths = filePaths.map((filePath) => {
      if (path.isAbsolute(filePath)) {
        return path.relative(projectPath, filePath)
      }
      return filePath
    })

    await git.add(relativePaths)

    // Clear cache to force refresh on next status check
    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to stage files: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_STAGE_FAILED'
    )
  }
}

export async function unstageFiles(projectId: number, filePaths: string[]): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    // Convert absolute paths to relative paths if needed
    const relativePaths = filePaths.map((filePath) => {
      if (path.isAbsolute(filePath)) {
        return path.relative(projectPath, filePath)
      }
      return filePath
    })

    await git.reset(['HEAD', ...relativePaths])

    // Clear cache to force refresh on next status check
    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to unstage files: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_UNSTAGE_FAILED'
    )
  }
}

export async function stageAll(projectId: number): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    await git.add('.')

    // Clear cache to force refresh on next status check
    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to stage all files: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_STAGE_ALL_FAILED'
    )
  }
}

export async function unstageAll(projectId: number): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    await git.reset(['HEAD'])

    // Clear cache to force refresh on next status check
    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to unstage all files: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_UNSTAGE_ALL_FAILED'
    )
  }
}

export async function commitChanges(projectId: number, message: string): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    // Check if there are staged changes
    const status = await git.status()
    if (status.staged.length === 0) {
      throw new ApiError(400, 'No staged changes to commit', 'NO_STAGED_CHANGES')
    }

    // Commit the changes
    await git.commit(message)

    // Clear cache to force refresh on next status check
    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to commit changes: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_COMMIT_FAILED'
    )
  }
}

// ============================================
// Branch Management
// ============================================

export async function getBranches(projectId: number): Promise<GitBranch[]> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const branchSummary = await git.branchLocal()
    const remoteBranches = await git.branch(['-r'])

    const branches: GitBranch[] = []

    // Add local branches
    for (const [name, branch] of Object.entries(branchSummary.branches)) {
      branches.push({
        name,
        current: branch.current,
        isRemote: false,
        commit: branch.commit,
        tracking: branch.tracking || null,
        ahead: branch.ahead || 0,
        behind: branch.behind || 0
      })
    }

    // Add remote branches
    for (const [name, branch] of Object.entries(remoteBranches.branches)) {
      if (!name.includes('HEAD')) {
        branches.push({
          name,
          current: false,
          isRemote: true,
          commit: branch.commit,
          tracking: null,
          ahead: 0,
          behind: 0
        })
      }
    }

    return branches
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get branches: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_BRANCHES_FAILED'
    )
  }
}

export async function getCurrentBranch(projectId: number): Promise<string | null> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const status = await git.status()
    return status.current || null
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_CURRENT_BRANCH_FAILED'
    )
  }
}

export async function createBranch(projectId: number, branchName: string, startPoint?: string): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    if (startPoint) {
      await git.checkoutBranch(branchName, startPoint)
    } else {
      await git.checkoutLocalBranch(branchName)
    }

    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to create branch: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_CREATE_BRANCH_FAILED'
    )
  }
}

export async function switchBranch(projectId: number, branchName: string): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    await git.checkout(branchName)
    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to switch branch: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_SWITCH_BRANCH_FAILED'
    )
  }
}

export async function deleteBranch(projectId: number, branchName: string, force: boolean = false): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    if (force) {
      await git.deleteLocalBranch(branchName, true)
    } else {
      await git.deleteLocalBranch(branchName)
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to delete branch: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_DELETE_BRANCH_FAILED'
    )
  }
}

export async function mergeBranch(
  projectId: number,
  branchName: string,
  options?: { noFastForward?: boolean; message?: string }
): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const mergeOptions: string[] = []
    if (options?.noFastForward) {
      mergeOptions.push('--no-ff')
    }
    if (options?.message) {
      mergeOptions.push('-m', options.message)
    }

    await git.merge([branchName, ...mergeOptions])
    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to merge branch: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_MERGE_FAILED'
    )
  }
}

// ============================================
// Commit History & Log
// ============================================

export async function getCommitLog(
  projectId: number,
  options?: {
    limit?: number
    skip?: number
    offset?: number // Support both skip and offset for compatibility
    branch?: string
    file?: string
  }
): Promise<GitLogEntry[]> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    // Use simple-git's built-in format object
    const logOptions: any = {
      format: {
        hash: '%H',
        abbreviatedHash: '%h',
        message: '%s',
        authorName: '%an',
        authorEmail: '%ae',
        date: '%ai', // ISO 8601 format
        refs: '%D'
      }
    }

    // Handle pagination - skip/offset are treated the same
    const skipCount = options?.skip ?? options?.offset ?? 0
    // When using skip, we need to fetch skip + limit items, then slice
    if (options?.limit || skipCount > 0) {
      logOptions.maxCount = (options?.limit || 100) + skipCount
    }

    if (options?.file) {
      logOptions.file = path.join(projectPath, options.file)
    }

    // Use simple-git's log method with built-in options
    // Pass branch as first argument if specified
    const logResult = options?.branch ? await git.log([options.branch], logOptions) : await git.log(logOptions)

    // Map the results to our schema
    const allEntries = logResult.all.map((commit: any) => ({
      hash: commit.hash,
      abbreviatedHash: commit.abbreviatedHash || commit.hash.substring(0, 7),
      message: commit.message,
      author: {
        name: commit.authorName || '',
        email: commit.authorEmail || ''
      },
      date: commit.date || new Date().toISOString(),
      refs: commit.refs || ''
    }))
    // Apply offset/skip by slicing the results
    if (skipCount > 0) {
      return allEntries.slice(skipCount, skipCount + (options?.limit || allEntries.length))
    }
    return allEntries
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get commit log: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_LOG_FAILED'
    )
  }
}

export async function getCommitDetails(projectId: number, commitHash: string): Promise<GitCommit> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const [commitInfo, diffSummary] = await Promise.all([
      git.show([commitHash, '--format=%H%n%s%n%b%n%an%n%ae%n%ai%n%cn%n%ce%n%ci%n%P']),
      git.diffSummary([`${commitHash}^`, commitHash])
    ])

    const lines = commitInfo.split('\n')
    const hash = lines[0]
    const subject = lines[1]
    const body = lines[2]
    const message = body ? `${subject}\n\n${body}` : subject

    return {
      hash,
      message,
      author: {
        name: lines[3],
        email: lines[4],
        date: lines[5]
      },
      committer: {
        name: lines[6],
        email: lines[7],
        date: lines[8]
      },
      parents: lines[9] ? lines[9].split(' ') : [],
      files: diffSummary.files.map((f) => f.file)
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get commit details: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_COMMIT_DETAILS_FAILED'
    )
  }
}

export async function getFileDiff(
  projectId: number,
  filePath: string,
  options?: { commit?: string; staged?: boolean }
): Promise<string> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    if (options?.staged) {
      return await git.diff(['--cached', '--', filePath])
    } else if (options?.commit) {
      return await git.diff([`${options.commit}^`, options.commit, '--', filePath])
    } else {
      return await git.diff(['--', filePath])
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get file diff: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_DIFF_FAILED'
    )
  }
}

export async function getCommitDiff(projectId: number, commitHash: string): Promise<GitDiff> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const [diffSummary, diffContent] = await Promise.all([
      git.diffSummary([`${commitHash}^`, commitHash]),
      git.diff([`${commitHash}^`, commitHash])
    ])

    return {
      files: diffSummary.files.map((file) => ({
        path: file.file,
        type: file.binary
          ? 'modified'
          : file.insertions > 0 && file.deletions === 0
            ? 'added'
            : file.insertions === 0 && file.deletions > 0
              ? 'deleted'
              : 'modified',
        additions: file.insertions,
        deletions: file.deletions,
        binary: file.binary
      })),
      additions: diffSummary.insertions,
      deletions: diffSummary.deletions,
      content: diffContent
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get commit diff: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_COMMIT_DIFF_FAILED'
    )
  }
}

export async function cherryPick(projectId: number, commitHash: string): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    await git.raw(['cherry-pick', commitHash])
    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to cherry-pick commit: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_CHERRY_PICK_FAILED'
    )
  }
}

// ============================================
// Remote Operations
// ============================================

export async function getRemotes(projectId: number): Promise<GitRemote[]> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const remotes = await git.getRemotes(true)

    return remotes.map((remote) => ({
      name: remote.name,
      fetch: remote.refs.fetch || '',
      push: remote.refs.push || ''
    }))
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get remotes: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_REMOTES_FAILED'
    )
  }
}

export async function addRemote(projectId: number, name: string, url: string): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    await git.addRemote(name, url)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to add remote: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_ADD_REMOTE_FAILED'
    )
  }
}

export async function removeRemote(projectId: number, name: string): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    await git.removeRemote(name)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to remove remote: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_REMOVE_REMOTE_FAILED'
    )
  }
}

export async function fetch(
  projectId: number,
  remote: string = 'origin',
  options?: { prune?: boolean }
): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const fetchOptions: string[] = []
    if (options?.prune) {
      fetchOptions.push('--prune')
    }

    await git.fetch([remote, ...fetchOptions])
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to fetch from remote: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_FETCH_FAILED'
    )
  }
}

export async function pull(
  projectId: number,
  remote: string = 'origin',
  branch?: string,
  options?: { rebase?: boolean }
): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const pullOptions: string[] = []
    if (options?.rebase) {
      pullOptions.push('--rebase')
    }

    if (branch) {
      await git.pull(remote, branch, pullOptions)
    } else {
      await git.pull(remote, pullOptions)
    }

    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to pull from remote: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_PULL_FAILED'
    )
  }
}

export async function push(
  projectId: number,
  remote: string = 'origin',
  branch?: string,
  options?: { force?: boolean; setUpstream?: boolean }
): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const pushOptions: string[] = []
    if (options?.force) {
      pushOptions.push('--force')
    }
    if (options?.setUpstream) {
      pushOptions.push('--set-upstream')
    }

    if (branch) {
      await git.push(remote, branch, pushOptions)
    } else {
      await git.push(remote, pushOptions)
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to push to remote: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_PUSH_FAILED'
    )
  }
}

// ============================================
// Tag Management
// ============================================

export async function getTags(projectId: number): Promise<GitTag[]> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const tags = await git.tags([
      '--format=%(refname:short)%09%(objectname)%09%(subject)%09%(taggername)%09%(taggeremail)%09%(taggerdate:iso)'
    ])

    return tags.all.map((tagLine) => {
      const [name, commit, annotation = '', taggerName = '', taggerEmail = '', taggerDate = ''] = tagLine.split('\t')

      const tag: GitTag = {
        name,
        commit,
        annotation: annotation || undefined
      }

      if (taggerName && taggerEmail) {
        tag.tagger = {
          name: taggerName,
          email: taggerEmail,
          date: taggerDate
        }
      }

      return tag
    })
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get tags: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_TAGS_FAILED'
    )
  }
}

export async function createTag(
  projectId: number,
  tagName: string,
  options?: { message?: string; ref?: string }
): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const tagOptions: string[] = []
    if (options?.message) {
      tagOptions.push('-a', tagName, '-m', options.message)
    } else {
      tagOptions.push(tagName)
    }

    if (options?.ref) {
      tagOptions.push(options.ref)
    }

    await git.tag(tagOptions)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to create tag: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_CREATE_TAG_FAILED'
    )
  }
}

export async function deleteTag(projectId: number, tagName: string): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    await git.tag(['-d', tagName])
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to delete tag: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_DELETE_TAG_FAILED'
    )
  }
}

// ============================================
// Stash Management
// ============================================

export async function stash(projectId: number, message?: string): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    if (message) {
      await git.stash(['push', '-m', message])
    } else {
      await git.stash()
    }

    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to stash changes: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_STASH_FAILED'
    )
  }
}

export async function stashList(projectId: number): Promise<GitStash[]> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const stashListResult = await git.stashList()

    return stashListResult.all.map((stashItem, index) => {
      // Parse stash message format: stash@{0}: WIP on branch: message
      const match = stashItem.message.match(/WIP on (.+?): (.+)$/) || stashItem.message.match(/On (.+?): (.+)$/)

      return {
        index,
        message: match ? match[2] : stashItem.message,
        branch: match ? match[1] : 'unknown',
        date: stashItem.date || new Date().toISOString()
      }
    })
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to list stashes: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_STASH_LIST_FAILED'
    )
  }
}

export async function stashApply(projectId: number, stashRef: string = 'stash@{0}'): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    await git.stash(['apply', stashRef])
    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to apply stash: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_STASH_APPLY_FAILED'
    )
  }
}

export async function stashPop(projectId: number, stashRef: string = 'stash@{0}'): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    await git.stash(['pop', stashRef])
    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to pop stash: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_STASH_POP_FAILED'
    )
  }
}

export async function stashDrop(projectId: number, stashRef: string = 'stash@{0}'): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    await git.stash(['drop', stashRef])
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to drop stash: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_STASH_DROP_FAILED'
    )
  }
}

// ============================================
// Reset & Revert
// ============================================

export async function reset(projectId: number, ref: string, mode: 'soft' | 'mixed' | 'hard' = 'mixed'): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    await git.reset([`--${mode}`, ref])
    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to reset: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_RESET_FAILED'
    )
  }
}

export async function revert(projectId: number, commitHash: string, options?: { noCommit?: boolean }): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const revertOptions: string[] = []
    if (options?.noCommit) {
      revertOptions.push('--no-commit')
    }

    await git.revert(commitHash, revertOptions)
    clearGitStatusCache(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to revert commit: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_REVERT_FAILED'
    )
  }
}

// ============================================
// Blame
// ============================================

export async function blame(projectId: number, filePath: string): Promise<GitBlame> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    // Use git blame with porcelain format for easier parsing
    const blameResult = await git.raw(['blame', '--porcelain', filePath])

    const lines: GitBlameLine[] = []
    const blameLines = blameResult.split('\n')
    let i = 0

    while (i < blameLines.length) {
      const line = blameLines[i]
      if (!line) {
        i++
        continue
      }

      // Parse porcelain format
      const match = line.match(/^([0-9a-f]+) (\d+) (\d+)/)
      if (match) {
        const commit = match[1]
        const lineNumber = parseInt(match[3], 10)

        // Skip metadata lines
        let author = ''
        let date = ''
        let content = ''

        i++
        while (i < blameLines.length && !blameLines[i].startsWith('\t')) {
          const metaLine = blameLines[i]
          if (metaLine.startsWith('author ')) {
            author = metaLine.substring(7)
          } else if (metaLine.startsWith('author-time ')) {
            const timestamp = parseInt(metaLine.substring(12), 10)
            date = new Date(timestamp * 1000).toISOString()
          }
          i++
        }

        // Get the actual line content
        if (i < blameLines.length && blameLines[i].startsWith('\t')) {
          content = blameLines[i].substring(1)
        }

        lines.push({
          line: lineNumber,
          content,
          commit,
          author,
          date
        })
      }
      i++
    }

    return {
      path: filePath,
      lines
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get blame: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_BLAME_FAILED'
    )
  }
}

// ============================================
// Other Advanced Features
// ============================================

export async function clean(
  projectId: number,
  options?: { directories?: boolean; force?: boolean; dryRun?: boolean }
): Promise<string[]> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const cleanOptions: string[] = []
    if (options?.directories) {
      cleanOptions.push('-d')
    }
    if (options?.force) {
      cleanOptions.push('-f')
    }
    if (options?.dryRun) {
      cleanOptions.push('-n')
    }

    const result = await git.clean(cleanOptions.join(''))
    return result.split('\n').filter(Boolean)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to clean: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_CLEAN_FAILED'
    )
  }
}

export async function getConfig(
  projectId: number,
  key?: string,
  options?: { global?: boolean }
): Promise<string | Record<string, string>> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    if (key) {
      const configOptions: string[] = ['config']
      if (options?.global) {
        configOptions.push('--global')
      }
      configOptions.push(key)

      const value = await git.raw(configOptions)
      return value.trim()
    } else {
      const configOptions: string[] = ['config', '--list']
      if (options?.global) {
        configOptions.push('--global')
      }

      const configList = await git.raw(configOptions)
      const config: Record<string, string> = {}

      configList.split('\n').forEach((line) => {
        const [key, value] = line.split('=', 2)
        if (key && value) {
          config[key] = value
        }
      })

      return config
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get config: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_CONFIG_FAILED'
    )
  }
}

export async function setConfig(
  projectId: number,
  key: string,
  value: string,
  options?: { global?: boolean }
): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const configOptions: string[] = ['config']
    if (options?.global) {
      configOptions.push('--global')
    }
    configOptions.push(key, value)

    await git.raw(configOptions)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to set config: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_SET_CONFIG_FAILED'
    )
  }
}

// ============================================
// Worktree Management
// ============================================

export async function getWorktrees(projectId: number): Promise<GitWorktree[]> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    // Get worktrees using porcelain format for easier parsing
    const worktreeList = await git.raw(['worktree', 'list', '--porcelain'])

    const worktrees: GitWorktree[] = []
    const lines = worktreeList.split('\n')

    let currentWorktree: Partial<GitWorktree> = {}

    for (const line of lines) {
      if (!line.trim()) {
        // Empty line indicates end of worktree entry
        if (currentWorktree.path) {
          worktrees.push({
            path: currentWorktree.path,
            branch: currentWorktree.branch || 'HEAD',
            commit: currentWorktree.commit || '',
            isMain: currentWorktree.isMain || false,
            isLocked: currentWorktree.isLocked || false,
            lockReason: currentWorktree.lockReason,
            prunable: currentWorktree.prunable
          })
          currentWorktree = {}
        }
        continue
      }

      const [key, ...valueParts] = line.split(' ')
      const value = valueParts.join(' ')

      switch (key) {
        case 'worktree':
          currentWorktree.path = value
          // Check if this is the main worktree
          currentWorktree.isMain = path.resolve(value) === projectPath
          break
        case 'HEAD':
          currentWorktree.commit = value
          break
        case 'branch':
          // branch refs/heads/branch-name
          currentWorktree.branch = value.replace('refs/heads/', '')
          break
        case 'detached':
          // If detached, there's no branch
          currentWorktree.branch = 'HEAD'
          break
        case 'locked':
          currentWorktree.isLocked = true
          if (value) {
            currentWorktree.lockReason = value
          }
          break
        case 'prunable':
          currentWorktree.prunable = true
          break
      }
    }

    // Add the last worktree if exists
    if (currentWorktree.path) {
      worktrees.push({
        path: currentWorktree.path,
        branch: currentWorktree.branch || 'HEAD',
        commit: currentWorktree.commit || '',
        isMain: currentWorktree.isMain || false,
        isLocked: currentWorktree.isLocked || false,
        lockReason: currentWorktree.lockReason,
        prunable: currentWorktree.prunable
      })
    }

    return worktrees
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get worktrees: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_WORKTREES_FAILED'
    )
  }
}

export async function addWorktree(
  projectId: number,
  options: {
    path: string
    branch?: string
    newBranch?: string
    commitish?: string
    detach?: boolean
  }
): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    // Resolve the worktree path to absolute
    const worktreePath = path.resolve(options.path)

    const args = ['worktree', 'add']

    // Add options
    if (options.newBranch) {
      args.push('-b', options.newBranch)
    } else if (options.detach) {
      args.push('--detach')
    }

    args.push(worktreePath)

    // Add branch/commit to checkout
    if (options.commitish) {
      args.push(options.commitish)
    } else if (options.branch && !options.newBranch) {
      args.push(options.branch)
    }

    await git.raw(args)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to add worktree: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_ADD_WORKTREE_FAILED'
    )
  }
}

export async function removeWorktree(projectId: number, worktreePath: string, force: boolean = false): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    // Get current worktrees to validate
    const worktrees = await getWorktrees(projectId)
    const targetPath = path.resolve(worktreePath)
    const worktree = worktrees.find((w) => path.resolve(w.path) === targetPath)

    if (!worktree) {
      throw new ApiError(404, 'Worktree not found', 'WORKTREE_NOT_FOUND')
    }

    if (worktree.isMain) {
      throw new ApiError(400, 'Cannot remove the main worktree', 'CANNOT_REMOVE_MAIN_WORKTREE')
    }

    const args = ['worktree', 'remove']
    if (force) {
      args.push('--force')
    }
    args.push(targetPath)

    await git.raw(args)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to remove worktree: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_REMOVE_WORKTREE_FAILED'
    )
  }
}

export async function lockWorktree(projectId: number, worktreePath: string, reason?: string): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const targetPath = path.resolve(worktreePath)

    const args = ['worktree', 'lock']
    if (reason) {
      args.push('--reason', reason)
    }
    args.push(targetPath)

    await git.raw(args)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to lock worktree: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_LOCK_WORKTREE_FAILED'
    )
  }
}

export async function unlockWorktree(projectId: number, worktreePath: string): Promise<void> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const targetPath = path.resolve(worktreePath)

    await git.raw(['worktree', 'unlock', targetPath])
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to unlock worktree: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_UNLOCK_WORKTREE_FAILED'
    )
  }
}

export async function pruneWorktrees(projectId: number, dryRun: boolean = false): Promise<string[]> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    const args = ['worktree', 'prune']
    if (dryRun) {
      args.push('--dry-run')
    }
    args.push('--verbose')

    const result = await git.raw(args)

    // Parse the output to get pruned worktree paths
    const prunedPaths: string[] = []
    const lines = result.split('\n').filter(Boolean)

    for (const line of lines) {
      // Git outputs lines like "Removing worktrees/branch-name: gitdir file points to non-existent location"
      const match = line.match(/^Removing (.+?):|^Would remove (.+?):/)
      if (match) {
        prunedPaths.push(match[1] || match[2])
      }
    }

    return prunedPaths
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to prune worktrees: ${error instanceof Error ? error.message : String(error)}`,
      'GIT_PRUNE_WORKTREES_FAILED'
    )
  }
}

// ============================================
// Enhanced Commit History Features
// ============================================

/**
 * Calculates relative time from a date string
 */
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`

  const years = Math.floor(days / 365)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}

/**
 * Parse refs string into array of branch/tag names
 */
function parseRefs(refsString: string): string[] {
  if (!refsString) return []

  // Remove HEAD -> prefix and split by comma
  const cleaned = refsString.replace(/HEAD\s*->\s*/, '')
  if (!cleaned) return []

  return cleaned
    .split(',')
    .map((ref) => ref.trim())
    .filter(Boolean)
}

/**
 * Get enhanced commit log with detailed information
 */
export async function getCommitLogEnhanced(
  projectId: number,
  request: GitLogEnhancedRequest
): Promise<GitLogEnhancedResponse> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    // Get current branch if not specified
    const currentBranch = request.branch || (await git.status()).current || 'HEAD'

    // Calculate skip for pagination
    const skip = (request.page - 1) * request.perPage

    // Build log options
    const logOptions: any = {
      format: {
        hash: '%H',
        abbreviatedHash: '%h',
        subject: '%s',
        body: '%B',
        authorName: '%an',
        authorEmail: '%ae',
        authorDate: '%aI',
        committerName: '%cn',
        committerEmail: '%ce',
        committerDate: '%cI',
        parents: '%P',
        refs: '%D'
      },
      maxCount: request.perPage + skip + 1, // +1 to check if there are more
      '--': null // Separator for path specs
    }

    // Add filters
    if (request.author) {
      logOptions['--author'] = request.author
    }
    if (request.since) {
      logOptions['--since'] = request.since
    }
    if (request.until) {
      logOptions['--until'] = request.until
    }
    if (request.search) {
      logOptions['--grep'] = request.search
    }

    // Get commit log - pass branch as first argument if specified
    const logResult = request.branch ? await git.log([request.branch], logOptions) : await git.log(logOptions)
    const allCommits = logResult.all

    // Slice for pagination
    const pageCommits = allCommits.slice(skip, skip + request.perPage)
    const hasMore = allCommits.length > skip + request.perPage

    // Process commits
    const enhancedCommits: GitCommitEnhanced[] = await Promise.all(
      pageCommits.map(async (commit: any) => {
        const result: GitCommitEnhanced = {
          hash: commit.hash,
          abbreviatedHash: commit.abbreviatedHash || commit.hash.substring(0, 8),
          subject: commit.subject || commit.body?.split('\n')[0] || '',
          body: commit.body || commit.subject || '',
          author: {
            name: commit.authorName || '',
            email: commit.authorEmail || ''
          },
          committer: {
            name: commit.committerName || commit.authorName || '',
            email: commit.committerEmail || commit.authorEmail || ''
          },
          authoredDate: commit.authorDate || new Date().toISOString(),
          committedDate: commit.committerDate || commit.authorDate || new Date().toISOString(),
          relativeTime: getRelativeTime(commit.authorDate || new Date().toISOString()),
          parents: commit.parents ? commit.parents.split(' ').filter(Boolean) : [],
          refs: parseRefs(commit.refs || ''),
          stats: {
            filesChanged: 0,
            additions: 0,
            deletions: 0
          }
        }

        // Get file statistics if requested
        if (request.includeStats || request.includeFileDetails) {
          try {
            // Get numstat for this commit
            const numstat = await git.raw(['show', '--numstat', '--format=', commit.hash])

            const fileStats: GitFileStats[] = []
            let totalAdditions = 0
            let totalDeletions = 0

            const lines = numstat.trim().split('\n').filter(Boolean)
            for (const line of lines) {
              const parts = line.split('\t')
              if (parts.length >= 3) {
                const additions = parseInt(parts[0], 10) || 0
                const deletions = parseInt(parts[1], 10) || 0
                const filePath = parts[2]

                // Handle renames
                let status: GitFileStats['status'] = 'modified'
                let oldPath: string | undefined

                if (filePath.includes('=>')) {
                  // This is a rename
                  const renameParts = filePath.match(/(.+?)\s*=>\s*(.+)/)
                  if (renameParts) {
                    oldPath = renameParts[1].trim()
                    status = 'renamed'
                  }
                } else if (additions > 0 && deletions === 0) {
                  status = 'added'
                } else if (additions === 0 && deletions > 0) {
                  status = 'deleted'
                }

                if (request.includeFileDetails) {
                  fileStats.push({
                    path: filePath,
                    additions,
                    deletions,
                    status,
                    oldPath
                  })
                }

                totalAdditions += additions
                totalDeletions += deletions
              }
            }

            result.stats = {
              filesChanged: fileStats.length,
              additions: totalAdditions,
              deletions: totalDeletions
            }

            if (request.includeFileDetails) {
              result.fileStats = fileStats
            }
          } catch (error) {
            // If stats fail, continue without them
            console.error(`Failed to get stats for commit ${commit.hash}:`, error)
          }
        }

        return result
      })
    )

    return {
      success: true,
      data: {
        commits: enhancedCommits,
        pagination: {
          page: request.page,
          perPage: request.perPage,
          hasMore,
          totalCount: undefined // We don't know total without counting all
        },
        branch: currentBranch
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    return {
      success: false,
      message: `Failed to get enhanced commit log: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Get enhanced branches with detailed information
 */
export async function getBranchesEnhanced(projectId: number): Promise<GitBranchListEnhancedResponse> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    // Get current branch
    const status = await git.status()
    const currentBranch = status.current

    // Get all branches with verbose info
    const [localBranches, remoteBranches] = await Promise.all([git.branchLocal('-v'), git.branch(['-r', '-v'])])

    // Determine default branch (main or master)
    let defaultBranch = 'main'
    if ('main' in localBranches.branches) {
      defaultBranch = 'main'
    } else if ('master' in localBranches.branches) {
      defaultBranch = 'master'
    } else if ('origin/main' in remoteBranches.branches) {
      defaultBranch = 'main'
    } else if ('origin/master' in remoteBranches.branches) {
      defaultBranch = 'master'
    }

    const enhancedBranches: GitBranchEnhanced[] = []

    // Process local branches
    for (const [name, branch] of Object.entries(localBranches.branches)) {
      let latestCommit: any = null
      let authorDate: string | undefined

      try {
        // Get the latest commit info for this branch
        const logResult = await git.log([name, '-1'], {
          format: {
            hash: '%H',
            abbreviatedHash: '%h',
            subject: '%s',
            authorName: '%an',
            authorDate: '%aI'
          }
        })

        latestCommit = logResult.latest
        authorDate = latestCommit?.authorDate
      } catch (error) {
        console.error(`Failed to get log for branch ${name}:`, error)
      }

      // Fallback: use git show if log failed or no date
      if (!authorDate && branch.commit) {
        try {
          const showResult = await git.show([branch.commit, '--format=%aI', '--no-patch'])
          authorDate = showResult.trim()
        } catch (err) {
          logger.debug(`Failed to get date for commit ${branch.commit}`, err)
        }
      }

      // Calculate ahead/behind relative to default branch
      let ahead = 0
      let behind = 0

      if (name !== defaultBranch) {
        try {
          // Get ahead/behind counts
          const revList = await git.raw(['rev-list', '--left-right', '--count', `${defaultBranch}...${name}`])

          const [behindStr, aheadStr] = revList.trim().split('\t')
          behind = parseInt(behindStr, 10) || 0
          ahead = parseInt(aheadStr, 10) || 0
        } catch (error) {
          // If comparison fails, use tracking branch info
          ahead = branch.ahead || 0
          behind = branch.behind || 0
        }
      }

      enhancedBranches.push({
        name,
        current: branch.current,
        isRemote: false,
        latestCommit: {
          hash: latestCommit?.hash || branch.commit,
          abbreviatedHash: latestCommit?.abbreviatedHash || branch.commit.substring(0, 8),
          subject: latestCommit?.subject || '',
          author: latestCommit?.authorName || '',
          relativeTime: authorDate ? getRelativeTime(authorDate) : 'Unknown'
        },
        tracking: branch.tracking || null,
        ahead: ahead || branch.ahead || 0,
        behind: behind || branch.behind || 0,
        lastActivity: authorDate
      })
    }

    // Process remote branches (excluding HEAD)
    for (const [name, branch] of Object.entries(remoteBranches.branches)) {
      if (name.includes('HEAD')) continue

      let latestCommit: any = null
      let authorDate: string | undefined

      try {
        // Get the latest commit info for this branch
        const logResult = await git.log([name, '-1'], {
          format: {
            hash: '%H',
            abbreviatedHash: '%h',
            subject: '%s',
            authorName: '%an',
            authorDate: '%aI'
          }
        })

        latestCommit = logResult.latest
        authorDate = latestCommit?.authorDate
      } catch (error) {
        console.error(`Failed to get log for remote branch ${name}:`, error)
      }

      // Fallback: use git show if log failed or no date
      if (!authorDate && branch.commit) {
        try {
          const showResult = await git.show([branch.commit, '--format=%aI', '--no-patch'])
          authorDate = showResult.trim()
        } catch (err) {
          logger.debug(`Failed to get date for commit ${branch.commit}`, err)
        }
      }

      // Only add branch if we have at least basic info
      if (branch.commit) {
        enhancedBranches.push({
          name,
          current: false,
          isRemote: true,
          latestCommit: {
            hash: latestCommit?.hash || branch.commit,
            abbreviatedHash: latestCommit?.abbreviatedHash || branch.commit.substring(0, 8),
            subject: latestCommit?.subject || '',
            author: latestCommit?.authorName || '',
            relativeTime: authorDate ? getRelativeTime(authorDate) : 'Unknown'
          },
          tracking: null,
          ahead: 0,
          behind: 0,
          lastActivity: authorDate
        })
      }
    }

    // Sort branches by last activity (most recent first)
    enhancedBranches.sort((a, b) => {
      if (!a.lastActivity) return 1
      if (!b.lastActivity) return -1
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    })

    return {
      success: true,
      data: {
        branches: enhancedBranches,
        current: currentBranch,
        defaultBranch
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    return {
      success: false,
      message: `Failed to get enhanced branches: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Get detailed information about a single commit
 */
export async function getCommitDetail(
  projectId: number,
  commitHash: string,
  includeFileContents: boolean = false
): Promise<GitCommitDetailResponse> {
  try {
    const project = await getProjectById(projectId)
    if (!project.path) {
      throw new ApiError(400, 'Project does not have a path associated with it', 'NO_PROJECT_PATH')
    }

    const projectPath = path.resolve(project.path)
    const git: SimpleGit = simpleGit(projectPath)

    // Get commit info using show
    const commitFormat = [
      '%H', // hash
      '%h', // abbreviated hash
      '%s', // subject
      '%b', // body
      '%an', // author name
      '%ae', // author email
      '%aI', // author date ISO
      '%cn', // committer name
      '%ce', // committer email
      '%cI', // committer date ISO
      '%P', // parents
      '%D' // refs
    ].join('%n')

    const showResult = await git.show([commitHash, `--format=${commitFormat}`, '--no-patch'])

    const lines = showResult.split('\n')
    const [hash, abbreviatedHash, subject, ...bodyAndRest] = lines

    // Find where the body ends (empty line after body)
    let bodyEndIndex = bodyAndRest.findIndex((line) => line === '')
    if (bodyEndIndex === -1) bodyEndIndex = bodyAndRest.length

    const body = bodyAndRest.slice(0, bodyEndIndex).join('\n')
    const metadataLines = bodyAndRest.slice(bodyEndIndex + 1)

    const [authorName, authorEmail, authorDate, committerName, committerEmail, committerDate, parents, refs] =
      metadataLines

    // Get file changes with numstat
    const numstatResult = await git.raw(['show', '--numstat', '--format=', commitHash])

    const fileDiffs: GitFileDiff[] = []
    let totalAdditions = 0
    let totalDeletions = 0

    const numstatLines = numstatResult.trim().split('\n').filter(Boolean)

    for (const line of numstatLines) {
      const parts = line.split('\t')
      if (parts.length >= 3) {
        const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0
        const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0
        const filePath = parts[2]

        // Determine file status
        let status: GitFileDiff['status'] = 'modified'
        let path = filePath
        let oldPath: string | undefined

        // Handle renames (format: "oldname => newname" or "{oldname => newname}")
        if (filePath.includes('=>')) {
          const renameParts = filePath.match(/^(?:\{(.+?)\s*=>\s*(.+?)\}|(.+?)\s*=>\s*(.+))$/)
          if (renameParts) {
            oldPath = renameParts[1] || renameParts[3]
            path = renameParts[2] || renameParts[4]
            status = 'renamed'
          }
        } else if (additions > 0 && deletions === 0) {
          status = 'added'
        } else if (additions === 0 && deletions > 0) {
          status = 'deleted'
        }

        fileDiffs.push({
          path,
          status,
          additions,
          deletions,
          binary: parts[0] === '-' && parts[1] === '-',
          oldPath
        })

        if (!fileDiffs[fileDiffs.length - 1].binary) {
          totalAdditions += additions
          totalDeletions += deletions
        }
      }
    }

    // Get individual file diffs if requested
    if (includeFileContents) {
      for (const file of fileDiffs) {
        if (!file.binary) {
          try {
            const diff = await git.diff([`${commitHash}^`, commitHash, '--', file.path])
            file.diff = diff
          } catch (error) {
            // For initial commits or other edge cases
            try {
              const diff = await git.show([commitHash, '--', file.path])
              file.diff = diff
            } catch {
              // Ignore diff errors
            }
          }
        }
      }
    }

    // Build enhanced commit object
    const enhancedCommit: GitCommitEnhanced = {
      hash,
      abbreviatedHash,
      subject,
      body: body || subject,
      author: {
        name: authorName || '',
        email: authorEmail || ''
      },
      committer: {
        name: committerName || authorName || '',
        email: committerEmail || authorEmail || ''
      },
      authoredDate: authorDate || new Date().toISOString(),
      committedDate: committerDate || authorDate || new Date().toISOString(),
      relativeTime: getRelativeTime(authorDate || new Date().toISOString()),
      parents: parents ? parents.split(' ').filter(Boolean) : [],
      refs: parseRefs(refs || ''),
      stats: {
        filesChanged: fileDiffs.length,
        additions: totalAdditions,
        deletions: totalDeletions
      },
      fileStats: fileDiffs.map((f) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        status: f.status,
        oldPath: f.oldPath
      }))
    }

    // Get full diff if requested
    let totalDiff: string | undefined
    if (includeFileContents) {
      try {
        totalDiff = await git.diff([`${commitHash}^`, commitHash])
      } catch {
        // For initial commits
        totalDiff = await git.show([commitHash])
      }
    }

    return {
      success: true,
      data: {
        commit: enhancedCommit,
        files: fileDiffs,
        totalDiff
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    return {
      success: false,
      message: `Failed to get commit detail: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
