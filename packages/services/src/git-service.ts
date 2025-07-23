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
  GitBlameLine
} from '@octoprompt/schemas'
import { getProjectById } from './project-service'
import { ApiError } from '@octoprompt/shared'
import path from 'path'
import { retryOperation } from './utils/retry-operation'

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
      const isRepo = await retryOperation(
        () => git.checkIsRepo(),
        {
          maxAttempts: 2,
          shouldRetry: (error) => {
            // Retry on network errors or temporary issues
            return error.message?.includes('ENOENT') === false && 
                   (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT')
          }
        }
      )
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
      const status = await retryOperation(
        () => git.status(),
        {
          maxAttempts: 3,
          shouldRetry: (error) => {
            // Retry on network errors (for remote tracking)
            return error.code === 'ENOTFOUND' || 
                   error.code === 'ETIMEDOUT' ||
                   error.message?.includes('Could not read from remote repository')
          }
        }
      )
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
    offset?: number  // Support both skip and offset for compatibility
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
    const logResult = await git.log(logOptions)

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
